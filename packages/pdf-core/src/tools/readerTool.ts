import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions, validateAndResolvePath } from '@sylphlab/mcp-core';
import { readFile } from 'node:fs/promises';
import * as mupdfjs from "mupdf/mupdfjs"; // Assuming mupdf is installed

// --- Zod Schemas ---

export const ReadOperationEnum = z.enum(['readPdfText']); // Add more later

// Input schema for a SINGLE reader operation
export const ReaderToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
  operation: ReadOperationEnum,
  filePath: z.string().min(1, 'filePath cannot be empty'),
  // Add options like page range later
});

// --- TypeScript Types ---
export type ReadOperation = z.infer<typeof ReadOperationEnum>;
export type ReaderToolInput = z.infer<typeof ReaderToolInputSchema>;

// Output interface for a SINGLE reader result
export interface ReaderToolOutput extends BaseMcpToolOutput {
  // BaseMcpToolOutput provides 'success' and 'content'
  id?: string; // Corresponds to input id if provided
  result?: string; // Extracted text/markdown
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---
export const readerTool: McpTool<typeof ReaderToolInputSchema, ReaderToolOutput> = {
  name: 'reader',
  description: 'Reads content from a file, specializing in formats like PDF.',
  inputSchema: ReaderToolInputSchema, // Schema for single item

  async execute(input: ReaderToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<ReaderToolOutput> {
    // Logic now directly processes the single 'input' object.
    const { id, operation, filePath: inputFilePath } = input;

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
      let operationResult: string | undefined;
      let suggestion: string | undefined;

      switch (operation) {
        case 'readPdfText': {
          console.log(`Reading PDF text from ${resolvedPath} using mupdf... (ID: ${id ?? 'N/A'})`);
          const buffer = await readFile(resolvedPath);
          const doc = mupdfjs.PDFDocument.openDocument(buffer, "application/pdf");
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
          operationResult = fullText.trim();
          suggestion = `Successfully read ${numPages} page(s) from PDF.`;
          console.log(`PDF text read successfully using mupdf. Pages: ${numPages}. (ID: ${id ?? 'N/A'})`);
          break;
        }
        // No default needed due to Zod validation
      }

      return {
        success: true,
        id: id,
        result: operationResult,
        content: [{ type: 'text', text: `Reader operation '${operation}' successful.` }],
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
          errorMsg = `Operation '${operation}' failed for ${inputFilePath}: ${e.message || 'Unknown error'}`;
          errorSuggestion = 'Ensure the file is valid (e.g., PDF) and not corrupted. Check file permissions.';
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

console.log('MCP Reader Tool (Single Operation) Loaded');