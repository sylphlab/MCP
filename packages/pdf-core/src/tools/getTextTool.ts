import { readFile } from 'node:fs/promises';
import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/mcp-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import * as mupdfjs from 'mupdf/mupdfjs';
import { z } from 'zod';
import { type GetTextItemSchema, getTextToolInputSchema } from './getTextTool.schema.js';

// --- Core Logic Function ---

/**
 * Extracts text content from a PDF buffer using MuPDF.
 * @param pdfBuffer Buffer containing the PDF data.
 * @returns A promise resolving to the extracted text content.
 * @throws If PDF parsing or text extraction fails.
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  // Ensure MuPDF is initialized (important if running in different contexts)
  // await mupdfjs.ready; // Assuming ready promise exists or handle initialization

  let doc: mupdfjs.PDFDocument | undefined;
  try {
    doc = mupdfjs.PDFDocument.openDocument(pdfBuffer, 'application/pdf');
    const numPages = doc.countPages();
    const pageTexts: string[] = [];

    for (let i = 0; i < numPages; i++) {
      let page: mupdfjs.PDFPage | undefined;
      try {
        page = doc.loadPage(i);
        pageTexts.push(page.getText());
      } finally {
        page?.destroy(); // Ensure page resources are freed
      }
    }
    return pageTexts.join('\n').trim();
  } finally {
    doc?.destroy(); // Ensure document resources are freed
  }
}

// --- TypeScript Types ---
export type GetTextInputItem = z.infer<typeof GetTextItemSchema>;
export type GetTextToolInput = z.infer<typeof getTextToolInputSchema>;

// --- Output Types ---
// Interface for a single PDF text extraction result item
export interface GetTextResultItem {
  /** Optional ID from the input item. */
  id?: string;
  /** The input file path. */
  path: string;
  /** Whether the text extraction for this item was successful. */
  success: boolean;
  /** The extracted text content, if successful. */
  result?: string;
  /** Error message, if extraction failed for this item. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const GetTextResultItemSchema = z.object({
  id: z.string().optional(),
  path: z.string(), // Added path to result schema
  success: z.boolean(),
  result: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const GetTextToolOutputSchema = z.array(GetTextResultItemSchema);

// --- Helper Function ---

// Helper function to process a single PDF text extraction item
async function processSinglePdfGetText(
  item: GetTextInputItem,
  options: ToolExecuteOptions,
): Promise<GetTextResultItem> {
  const { id, filePath: inputFilePath } = item;
  // Initialize result with path
  const resultItem: GetTextResultItem = { id, path: inputFilePath, success: false };
  const { workspaceRoot, allowOutsideWorkspace } = options;

  let resolvedPath: string | undefined;
  try {
    // --- Path Validation ---
    const validationResult = validateAndResolvePath(
      inputFilePath,
      workspaceRoot,
      allowOutsideWorkspace,
    );
    if (typeof validationResult !== 'string') {
      throw new Error(
        `Path validation failed: ${validationResult.error} ${validationResult.suggestion ?? ''}`,
      );
    }
    resolvedPath = validationResult;
    // --- End Path Validation ---

    const buffer = await readFile(resolvedPath);
    const extractedText = await extractPdfText(buffer); // Call the core function

    resultItem.success = true;
    resultItem.result = extractedText;
    resultItem.suggestion = 'Successfully extracted text from PDF.';
  } catch (e: unknown) {
    resultItem.success = false;
    const errorMsg = e instanceof Error ? e.message : String(e);
    resultItem.error = `Failed to get text from PDF '${inputFilePath}': ${errorMsg}`;

    // Provide suggestions based on error type
    if (errorMsg.includes('Path validation failed')) {
      // Suggestion is already part of the error message from validation
      resultItem.suggestion =
        errorMsg.split('Suggestion: ')[1] ?? 'Check path validity and workspace settings.';
    } else if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'ENOENT') {
        resultItem.suggestion = 'Ensure the file path is correct and the file exists.';
      } else if (e.code === 'EACCES') {
        resultItem.suggestion = 'Check file read permissions.';
      } else {
        resultItem.suggestion =
          'Ensure the file is a valid, uncorrupted PDF and check permissions.';
      }
    } else if (errorMsg.toLowerCase().includes('pdf')) {
      // Generic PDF error
      resultItem.suggestion = 'Ensure the file is a valid, uncorrupted PDF document.';
    } else {
      resultItem.suggestion = 'Check file path, permissions, and file validity.';
    }
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const getTextTool = defineTool({
  name: 'getText',
  description: 'Extracts text content from one or more PDF files.',
  inputSchema: getTextToolInputSchema,
  execute: async (input: GetTextToolInput, options: ToolExecuteOptions): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = getTextToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }

    // Add upfront check for workspaceRoot
    if (!options?.workspaceRoot) {
      throw new Error('Workspace root is not available in options.');
    }

    const { items } = parsed.data;
    const results: GetTextResultItem[] = [];

    // Process requests sequentially (or parallelize with Promise.all)
    for (const item of items) {
      const result = await processSinglePdfGetText(item, options);
      results.push(result);
    }

    // Return the results wrapped in jsonPart
    return [jsonPart(results, GetTextToolOutputSchema)];
  },
});

// Export necessary types
