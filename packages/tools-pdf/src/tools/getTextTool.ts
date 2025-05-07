import { readFile } from 'node:fs/promises';
import { defineTool } from '@sylphlab/tools-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/tools-core';
import type { Part, ToolExecuteOptions } from '@sylphlab/tools-core';
import { BaseContextSchema } from '@sylphlab/tools-core';
import * as mupdfjs from 'mupdf/mupdfjs';
import { z } from 'zod';
import { type GetTextItemSchema, getTextToolInputSchema } from './getTextTool.schema.js';

// --- Core Logic Function ---

/**
 * Extracts text content from a PDF buffer using MuPDF.
 * @param pdfBuffer Buffer containing the PDF data.
 * @param options Optional extraction options.
 * @returns A promise resolving to the extraction result containing text content and optional metadata.
 * @throws If PDF parsing or text extraction fails.
 */
export async function extractPdfText(
  pdfBuffer: Buffer,
  options?: {
    pages?: number[] | { start: number; end: number };
    includeMetadata?: boolean;
    includePageCount?: boolean;
  },
): Promise<{
  text: string;
  pageTexts?: { page: number; text: string }[];
  metadata?: Record<string, string>;
  pageCount?: number;
}> {
  let doc: mupdfjs.PDFDocument | undefined;
  try {
    doc = mupdfjs.PDFDocument.openDocument(pdfBuffer, 'application/pdf');
    const numPages = doc.countPages();
    const result: {
      text: string;
      pageTexts?: { page: number; text: string }[];
      metadata?: Record<string, string>;
      pageCount?: number;
    } = { text: '' };

    // Include page count if requested
    if (options?.includePageCount) {
      result.pageCount = numPages;
    }

    // Include metadata if requested
    if (options?.includeMetadata) {
      try {
        const metadata: Record<string, string> = {};
        // Common PDF metadata fields
        const metadataFields = [
          'Title',
          'Author',
          'Subject',
          'Keywords',
          'Creator',
          'Producer',
          'CreationDate',
          'ModDate',
        ];

        for (const field of metadataFields) {
          try {
            const value = doc.getMetaData(field);
            if (value) {
              metadata[field] = value;
            }
          } catch (_e) {
            // Ignore errors for individual metadata fields
          }
        }

        if (Object.keys(metadata).length > 0) {
          result.metadata = metadata;
        }
      } catch (_e) {
        // Ignore metadata extraction errors
      }
    }

    // Determine which pages to process
    let pagesToProcess: number[] = [];

    if (options?.pages) {
      // If pages is an array, use those specific pages
      if (Array.isArray(options.pages)) {
        pagesToProcess = options.pages
          .filter((p) => p > 0 && p <= numPages) // Filter out invalid page numbers
          .map((p) => p - 1); // Convert from 1-based to 0-based index
      }
      // If pages is a range object, use pages in that range
      else if (typeof options.pages === 'object') {
        const { start, end } = options.pages;
        const validStart = Math.max(1, Math.min(start, numPages));
        const validEnd = Math.max(validStart, Math.min(end, numPages));

        for (let i = validStart; i <= validEnd; i++) {
          pagesToProcess.push(i - 1); // Convert from 1-based to 0-based index
        }
      }
    } else {
      // If no pages specified, process all pages
      for (let i = 0; i < numPages; i++) {
        pagesToProcess.push(i);
      }
    }

    // Extract text from selected pages
    const pageTextsArray: { page: number; text: string }[] = [];
    const allText: string[] = [];

    for (const pageIndex of pagesToProcess) {
      let page: mupdfjs.PDFPage | undefined;
      try {
        page = doc.loadPage(pageIndex);
        const pageText = page.getText();

        // Store the page text with 1-based page number for output
        const pageNum = pageIndex + 1;
        pageTextsArray.push({ page: pageNum, text: pageText });
        allText.push(pageText);
      } finally {
        page?.destroy(); // Ensure page resources are freed
      }
    }

    // If individual page texts are requested via detailed options
    if (pageTextsArray.length > 0) {
      result.pageTexts = pageTextsArray;
    }

    // Combined text of all processed pages
    result.text = allText.join('\n').trim();

    return result;
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
  /** Metadata from the PDF, if requested and available. */
  metadata?: Record<string, string>;
  /** Total page count, if requested. */
  pageCount?: number;
  /** Individual page texts with their page numbers, if specific pages were requested. */
  pageTexts?: { page: number; text: string }[];
}

// Zod Schema for the individual result
const GetTextResultItemSchema = z.object({
  id: z.string().optional(),
  path: z.string(), // Added path to result schema
  success: z.boolean(),
  result: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  pageCount: z.number().int().positive().optional(),
  pageTexts: z
    .array(
      z.object({
        page: z.number().int().positive(),
        text: z.string(),
      }),
    )
    .optional(),
});

// Define the output schema instance as a constant array
const GetTextToolOutputSchema = z.array(GetTextResultItemSchema);

// --- Helper Function ---

// Helper function to process a single PDF text extraction item
async function processSinglePdfGetText(
  item: GetTextInputItem,
  options: ToolExecuteOptions,
  globalOptions: {
    includeMetadata?: boolean;
    includePageCount?: boolean;
  } = {},
): Promise<GetTextResultItem> {
  const { id, filePath: inputFilePath, pages } = item;
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

    // Prepare extraction options
    const extractionOptions = {
      pages,
      includeMetadata: globalOptions.includeMetadata,
      includePageCount: globalOptions.includePageCount,
    };

    // Call the enhanced core function with options
    const extractionResult = await extractPdfText(buffer, extractionOptions);

    resultItem.success = true;
    resultItem.result = extractionResult.text;

    // Include metadata if available
    if (extractionResult.metadata) {
      resultItem.metadata = extractionResult.metadata;
    }

    // Include page count if available
    if (extractionResult.pageCount !== undefined) {
      resultItem.pageCount = extractionResult.pageCount;
    }

    // Include individual page texts if available
    if (extractionResult.pageTexts && extractionResult.pageTexts.length > 0) {
      resultItem.pageTexts = extractionResult.pageTexts;
    }

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
  name: 'get-text',
  description: 'Extracts text content from one or more PDF files.',
  inputSchema: getTextToolInputSchema,
  contextSchema: BaseContextSchema,
  execute: async ({
    context,
    args,
  }: { context: ToolExecuteOptions; args: GetTextToolInput }): Promise<Part[]> => {
    const parsed = getTextToolInputSchema.safeParse(args);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }

    if (!context?.workspaceRoot) {
      throw new Error('Workspace root is not available in context.');
    }

    const { items, includeMetadata, includePageCount } = parsed.data;
    const results: GetTextResultItem[] = [];

    const globalOptions = {
      includeMetadata,
      includePageCount,
    };

    for (const item of items) {
      const result = await processSinglePdfGetText(item, context, globalOptions);
      results.push(result);
    }

    return [jsonPart(results, GetTextToolOutputSchema)];
  },
});

// Export necessary types
