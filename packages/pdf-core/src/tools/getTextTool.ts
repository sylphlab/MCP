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

// Input schema for the getText tool
export const GetTextToolInputSchema = z.object({
  id: z.string().optional(),
  filePath: z.string().min(1, 'filePath cannot be empty'),
  // operation: z.literal('getText'), // Operation is implicit in the tool name now
});

// --- TypeScript Types ---
export type GetTextToolInput = z.infer<typeof GetTextToolInputSchema>;

// Output interface for the getText tool result
export interface GetTextToolOutput extends BaseMcpToolOutput {
  id?: string;
  result?: string; // Extracted text
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---
export const getTextTool: McpTool<typeof GetTextToolInputSchema, GetTextToolOutput> = {
  name: 'getText', // Specific action name
  description: 'Extracts text content from a PDF file.',
  inputSchema: GetTextToolInputSchema,

  async execute(input: GetTextToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<GetTextToolOutput> {
    const { id, filePath: inputFilePath } = input;

    // --- Path Validation ---
    const validationResult = validateAndResolvePath(inputFilePath, workspaceRoot, options?.allowOutsideWorkspace);
    if (typeof validationResult !== 'string') {
      const errorMsg = validationResult.error;
      console.error(`Path validation failed for ${inputFilePath}: ${errorMsg}`);
      return {
        success: false,
        id: id,
        error: errorMsg,
        suggestion: validationResult.suggestion,
        content: [],
      };
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
        const suggestion = `Successfully extracted text from PDF.`;
        console.log(`PDF text extracted successfully. (ID: ${id ?? 'N/A'})`);

        return {
            success: true,
            id: id,
            result: extractedText,
            content: [{ type: 'text', text: suggestion }], // Keep content simple
            suggestion: suggestion,
        };

    } catch (e: any) {
      let errorMsg: string;
      let errorSuggestion: string | undefined;
      if (e.code === 'ENOENT') {
          errorMsg = `File not found: ${inputFilePath}`;
          errorSuggestion = 'Ensure the file path is correct and the file exists.';
      } else if (e.code === 'EACCES') {
          errorMsg = `Permission denied: Cannot read file ${inputFilePath}`;
          errorSuggestion = 'Check file read permissions.';
      } else {
          // Catch errors from readFile or extractPdfText
          errorMsg = `Failed to get text from PDF '${inputFilePath}': ${e.message || 'Unknown error'}`;
          errorSuggestion = 'Ensure the file is a valid PDF and not corrupted. Check file permissions.';
      }
      console.error(errorMsg);
      return {
        success: false,
        id: id,
        error: errorMsg,
        suggestion: errorSuggestion,
        content: [],
      };
    }
  },
};

console.log('MCP PDF GetText Tool Loaded');