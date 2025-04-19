import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions, validateAndResolvePath } from '@sylphlab/mcp-core';
import { readFile } from 'node:fs/promises';
import * as mupdfjs from "mupdf/mupdfjs";

// --- Core Logic Function ---

/**
 * Extracts text content from a PDF buffer using MuPDF.
 * @param pdfBuffer Buffer containing the PDF data.
 * @returns A promise resolving to the extracted text content.
 * @throws If PDF parsing or text extraction fails.
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
    const doc = mupdfjs.PDFDocument.openDocument(pdfBuffer, "application/pdf");
    let fullText = '';
    const numPages = doc.countPages();
    for (let i = 0; i < numPages; i++) {
        const page = doc.loadPage(i);
        try {
            const structuredTextJson = page.toStructuredText("preserve-whitespace").asJSON();
            const structuredText = JSON.parse(structuredTextJson);
            let pageText = '';
            if (structuredText && structuredText.blocks) {
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
            fullText += pageText + '\n';
        } finally {
            // MuPDF JS bindings might handle cleanup automatically. Monitor memory if needed.
        }
    }
    // Consider freeing doc if necessary/possible
    return fullText.trim();
}


// --- Zod Schemas ---

// Schema for a single PDF text extraction item
const GetTextInputItemSchema = z.object({
  id: z.string().optional(),
  filePath: z.string().min(1, 'filePath cannot be empty'),
  // Add options like page range later if needed
});

// Main input schema: an array of PDF text extraction items
export const GetTextToolInputSchema = z.object({
  items: z.array(GetTextInputItemSchema).min(1, 'At least one PDF file path is required.'),
});

// --- TypeScript Types ---
export type GetTextInputItem = z.infer<typeof GetTextInputItemSchema>;
export type GetTextToolInput = z.infer<typeof GetTextToolInputSchema>;

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
  workspaceRoot: string,
  allowOutsideWorkspace?: boolean
): Promise<GetTextResultItem> {
  const { id, filePath: inputFilePath } = item;
  const resultItem: GetTextResultItem = { id, success: false };

  // --- Path Validation ---
  const validationResult = validateAndResolvePath(inputFilePath, workspaceRoot, allowOutsideWorkspace);
  if (typeof validationResult !== 'string') {
    resultItem.error = validationResult.error;
    resultItem.suggestion = validationResult.suggestion;
    console.error(`Path validation failed for ${inputFilePath} (ID: ${id ?? 'N/A'}): ${resultItem.error}`);
    return resultItem; // Return early with validation error
  }
  const resolvedPath = validationResult;
  // --- End Path Validation ---

  try {
    // --- File Reading ---
    console.log(`Reading PDF file: ${resolvedPath}... (ID: ${id ?? 'N/A'})`);
    const buffer = await readFile(resolvedPath);

    // --- Core Logic Execution ---
    console.log(`Extracting text using MuPDF... (ID: ${id ?? 'N/A'})`);
    const extractedText = await extractPdfText(buffer); // Call the core function
    resultItem.success = true;
    resultItem.result = extractedText;
    resultItem.suggestion = `Successfully extracted text from PDF.`;
    console.log(`PDF text extracted successfully. (ID: ${id ?? 'N/A'})`);

  } catch (e: any) {
    if (e.code === 'ENOENT') {
        resultItem.error = `File not found: ${inputFilePath}`;
        resultItem.suggestion = 'Ensure the file path is correct and the file exists.';
    } else if (e.code === 'EACCES') {
        resultItem.error = `Permission denied: Cannot read file ${inputFilePath}`;
        resultItem.suggestion = 'Check file read permissions.';
    } else {
        // Catch errors from readFile or extractPdfText
        resultItem.error = `Failed to get text from PDF '${inputFilePath}': ${e.message || 'Unknown error'}`;
        resultItem.suggestion = 'Ensure the file is a valid PDF and not corrupted. Check file permissions.';
    }
    console.error(`${resultItem.error} (ID: ${id ?? 'N/A'})`);
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}


// --- Tool Definition ---
export const getTextTool: McpTool<typeof GetTextToolInputSchema, GetTextToolOutput> = {
  name: 'getText',
  description: 'Extracts text content from one or more PDF files.',
  inputSchema: GetTextToolInputSchema, // Schema expects { items: [...] }

  async execute(input: GetTextToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<GetTextToolOutput> {
    // Input validation happens before execute in the registerTools helper
    const { items } = input;
    const results: GetTextResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process requests sequentially (file I/O and PDF parsing can be intensive)
      for (const item of items) {
        const result = await processSinglePdfGetText(item, workspaceRoot, options?.allowOutsideWorkspace); // Process each item
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
        }
      }

      return {
        success: overallSuccess,
        results: results,
        content: [{ type: 'text', text: `Processed ${items.length} PDF text extraction requests. Overall success: ${overallSuccess}` }],
      };
    } catch (e: any) {
      // Catch unexpected errors during the loop itself (should be rare)
      const errorMsg = `Unexpected error during PDF getText tool execution: ${e.message}`;
      console.error(errorMsg);
      return {
        success: false,
        results: results, // Return partial results if any
        error: errorMsg,
        content: [],
      };
    }
  },
};

console.log('MCP PDF Core Tool (getText - Batch Operation) Loaded');