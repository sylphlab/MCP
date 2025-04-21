import { readFile } from 'node:fs/promises';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
  validateAndResolvePath,
} from '@sylphlab/mcp-core';
import * as mupdfjs from 'mupdf/mupdfjs';
import type { z } from 'zod';
import { type GetTextItemSchema, getTextToolInputSchema } from './getTextTool.schema.js'; // Import schema (added .js)

// --- Core Logic Function ---

/**
 * Extracts text content from a PDF buffer using MuPDF.
 * @param pdfBuffer Buffer containing the PDF data.
 * @returns A promise resolving to the extracted text content.
 * @throws If PDF parsing or text extraction fails.
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const doc = mupdfjs.PDFDocument.openDocument(pdfBuffer, 'application/pdf');
  const numPages = doc.countPages();
  const pageTexts: string[] = [];

  for (let i = 0; i < numPages; i++) {
    const page = doc.loadPage(i);
    pageTexts.push(page.getText());
    // Note: You can also use page.getText('text') for more control over text extraction
  }

  return pageTexts.join('\n').trim();
}

// --- TypeScript Types ---
export type GetTextInputItem = z.infer<typeof GetTextItemSchema>;
export type GetTextToolInput = z.infer<typeof getTextToolInputSchema>;

// Interface for a single PDF text extraction result item
export interface GetTextResultItem {
  id?: string;
  success: boolean;
  result?: string; // Extracted text
  error?: string;
  suggestion?: string;
}

// Output interface for the tool (includes multiple results)
export interface GetTextToolOutput extends BaseMcpToolOutput {
  results: GetTextResultItem[];
  error?: string; // Optional overall error if the tool itself fails unexpectedly
}

// --- Helper Function ---

// Helper function to process a single PDF text extraction item
async function processSinglePdfGetText(
  item: GetTextInputItem,
  options: McpToolExecuteOptions, // Use options object
): Promise<GetTextResultItem> {
  const { id, filePath: inputFilePath } = item;
  const resultItem: GetTextResultItem = { id, success: false };
  const { workspaceRoot, allowOutsideWorkspace } = options; // Extract from options

  // --- Path Validation ---
  const validationResult = validateAndResolvePath(
    inputFilePath,
    workspaceRoot,
    allowOutsideWorkspace,
  ); // Use extracted values
  if (typeof validationResult !== 'string') {
    resultItem.error = validationResult.error;
    resultItem.suggestion = validationResult.suggestion;
    return resultItem; // Return early with validation error
  }
  const resolvedPath = validationResult;
  // --- End Path Validation ---

  try {
    const buffer = await readFile(resolvedPath);
    const extractedText = await extractPdfText(buffer); // Call the core function
    resultItem.success = true;
    resultItem.result = extractedText;
    resultItem.suggestion = 'Successfully extracted text from PDF.';
  } catch (e: unknown) {
    // console.log(e); // Removed console.log
    // Check if e is an object with a code property before accessing it
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'ENOENT') {
        resultItem.error = `File not found: ${inputFilePath}`;
        resultItem.suggestion = 'Ensure the file path is correct and the file exists.';
      } else if (e.code === 'EACCES') {
        resultItem.error = `Permission denied: Cannot read file ${inputFilePath}`;
        resultItem.suggestion = 'Check file read permissions.';
      } else {
        // Handle other errors with a code property if necessary, or fall through
        const message = e instanceof Error ? e.message : String(e);
        resultItem.error = `Failed to get text from PDF '${inputFilePath}': ${message}`;
        resultItem.suggestion =
          'Ensure the file is a valid PDF and not corrupted. Check file permissions.';
      }
    } else {
      // Catch errors from readFile or extractPdfText (likely Error instances)
      const message = e instanceof Error ? e.message : String(e);
      resultItem.error = `Failed to get text from PDF '${inputFilePath}': ${message}`;
      resultItem.suggestion =
        'Ensure the file is a valid PDF and not corrupted. Check file permissions.';
    }
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const getTextTool = defineTool({
  name: 'getText',
  description: 'Extracts text content from one or more PDF files.',
  inputSchema: getTextToolInputSchema, // Schema expects { items: [...] }

  execute: async ( // Core logic passed to defineTool
    input: GetTextToolInput,
    options: McpToolExecuteOptions, // Options are received here
  ): Promise<GetTextToolOutput> => { // Still returns the specific output type

    // Input validation is handled by registerTools/SDK
    const { items } = input;

    const results: GetTextResultItem[] = [];
    let overallSuccess = true; // Assume success until a failure occurs

    // Removed the outermost try/catch block; defineTool handles unexpected errors

    // Process requests sequentially
    for (const item of items) {
      // processSinglePdfGetText handles its own errors for individual file processing
      const result = await processSinglePdfGetText(item, options);
      results.push(result);
      if (!result.success) {
        overallSuccess = false; // Mark overall as failed if any item fails
      }
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Processed ${items.length} PDF text extraction requests. Overall success: ${overallSuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess,
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { GetTextToolInput, GetTextToolOutput, GetTextResultItem, GetTextInputItem }; // Removed duplicate export
