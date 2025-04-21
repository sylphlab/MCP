import { readFile } from 'node:fs/promises';
import {
  type BaseMcpToolOutput,
  type McpTool,
  type McpToolExecuteOptions,
  McpToolInput,
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
  let fullText = '';
  const numPages = doc.countPages();
  for (let i = 0; i < numPages; i++) {
    const page = doc.loadPage(i);
    try {
      const structuredTextJson = page.toStructuredText('preserve-whitespace').asJSON();
      const structuredText = JSON.parse(structuredTextJson);
      let pageText = '';
      if (structuredText?.blocks) {
        for (const block of structuredText.blocks) {
          if (block.lines) {
            for (const line of block.lines) {
              if (line.spans) {
                for (const span of line.spans) {
                  if (span.text) {
                    pageText += span.text;
                  }
                }
              }
            }
          }
        }
      }
      fullText += `${pageText}\n`;
    } finally {
      // MuPDF JS bindings might handle cleanup automatically. Monitor memory if needed.
    }
  }
  // Consider freeing doc if necessary/possible
  return fullText.trim();
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

// --- Tool Definition ---
export const getTextTool: McpTool<typeof getTextToolInputSchema, GetTextToolOutput> = {
  name: 'getText',
  description: 'Extracts text content from one or more PDF files.',
  inputSchema: getTextToolInputSchema, // Schema expects { items: [...] }

  async execute(
    input: GetTextToolInput,
    options: McpToolExecuteOptions,
  ): Promise<GetTextToolOutput> {
    // Remove workspaceRoot, require options
    // Input validation happens before execute in the registerTools helper
    const { items } = input;
    // workspaceRoot and allowOutsideWorkspace are now in options
    const results: GetTextResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process requests sequentially (file I/O and PDF parsing can be intensive)
      for (const item of items) {
        const result = await processSinglePdfGetText(item, options); // Pass options object directly
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
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
      ); // Pretty-print JSON for readability

      return {
        success: overallSuccess,
        results: results, // Keep original results field too
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (e: unknown) {
      // Catch unexpected errors during the loop itself (should be rare)
      const errorMsg = `Unexpected error during PDF getText tool execution: ${e instanceof Error ? e.message : String(e)}`;
      const errorContentText = JSON.stringify(
        {
          error: errorMsg,
          results: results, // Include partial results in error content too
        },
        null,
        2,
      );
      return {
        success: false,
        results: results, // Keep partial results here too
        error: errorMsg, // Keep top-level error
        content: [{ type: 'text', text: errorContentText }], // Put error JSON in content
      };
    }
  },
};
