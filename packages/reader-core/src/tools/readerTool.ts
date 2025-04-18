import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions, validateAndResolvePath } from '@sylphlab/mcp-core';
import { readFile } from 'node:fs/promises';
import * as mupdfjs from "mupdf/mupdfjs"; // Assuming mupdf is installed

// --- Zod Schemas ---

const ReadOperationEnum = z.enum(['readPdfText']); // Add more later

// Schema for a single reader operation item
const ReaderInputItemSchema = z.object({
  id: z.string().optional(),
  operation: ReadOperationEnum,
  filePath: z.string().min(1, 'filePath cannot be empty'),
  // Add options like page range later
});

// Main input schema: an array of reader items
export const ReaderToolInputSchema = z.object({
  items: z.array(ReaderInputItemSchema).min(1, 'At least one reader operation item is required.'),
});

// --- TypeScript Types ---
export type ReadOperation = z.infer<typeof ReadOperationEnum>;
export type ReaderInputItem = z.infer<typeof ReaderInputItemSchema>;
export type ReaderToolInput = z.infer<typeof ReaderToolInputSchema>;

// Interface for a single reader result item
export interface ReaderResultItem {
  id?: string;
  success: boolean;
  result?: string; // Extracted text/markdown
  error?: string;
  suggestion?: string;
}

// Output interface for the tool
export interface ReaderToolOutput extends BaseMcpToolOutput {
  results: ReaderResultItem[];
  error?: string; // Optional overall error
}

// --- Tool Definition ---

// Re-implement the core logic within the execute method
async function processSingleRead(item: ReaderInputItem, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<ReaderResultItem> {
  const { id, operation, filePath: inputFilePath } = item;
  const resultItem: ReaderResultItem = { id, success: false };

  // --- Path Validation ---
  const validationResult = validateAndResolvePath(inputFilePath, workspaceRoot, options?.allowOutsideWorkspace);
  if (typeof validationResult !== 'string') {
    resultItem.error = validationResult.error;
    resultItem.suggestion = validationResult.suggestion;
    console.error(`Path validation failed for ${inputFilePath}: ${resultItem.error}`);
    return resultItem; // Return early on path validation failure
  }
  const resolvedPath = validationResult;
  // --- End Path Validation ---

  try {
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
        resultItem.result = fullText.trim();
        resultItem.success = true;
        console.log(`PDF text read successfully using mupdf. Pages: ${numPages}. (ID: ${id ?? 'N/A'})`);
        break;
      }
      // No default needed due to Zod validation
    }
  } catch (e: any) {
    if (e.code === 'ENOENT') {
        resultItem.error = `File not found: ${inputFilePath}`;
        resultItem.suggestion = 'Ensure the file path is correct and the file exists.';
    } else if (e.code === 'EACCES') {
        resultItem.error = `Permission denied: Cannot read file ${inputFilePath}`;
        resultItem.suggestion = 'Check file read permissions.';
    } else {
        resultItem.error = `Operation '${operation}' failed for ${inputFilePath}: ${e.message || 'Unknown error'}`;
        resultItem.suggestion = 'Ensure the file is a valid PDF and not corrupted. Check file permissions.';
    }
    console.error(resultItem.error);
  }
  return resultItem;
}


export const readerTool: McpTool<typeof ReaderToolInputSchema, ReaderToolOutput> = {
  name: 'reader',
  description: 'Reads content from files, specializing in formats like PDF.',
  inputSchema: ReaderToolInputSchema,

  async execute(input: ReaderToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<ReaderToolOutput> {
    const { items } = input; // Input is validated by the server
    const results: ReaderResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process sequentially
      for (const item of items) {
        const result = await Promise.resolve(processSingleRead(item, workspaceRoot, options));
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
        }
      }

      return {
        success: overallSuccess,
        results: results,
        content: [{ type: 'text', text: `Processed ${items.length} reader operations. Overall success: ${overallSuccess}` }],
      };
    } catch (e: any) {
      console.error(`Unexpected error during reader tool execution: ${e.message}`);
      return {
        success: false,
        results: results,
        error: `Unexpected tool error: ${e.message}`,
        content: [],
      };
    }
  },
};

console.log('MCP Reader Tool Loaded');