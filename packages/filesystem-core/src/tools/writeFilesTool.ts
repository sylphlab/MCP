import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { type McpTool, type BaseMcpToolOutput, McpToolInput, validateAndResolvePath, type McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import base types and validation util
import { writeFilesToolInputSchema, type WriteFileItemSchema } from './writeFilesTool.schema.js'; // Import schema (added .js)

// Define BufferEncoding type for Zod schema
type BufferEncoding = 'utf-8' | 'base64'; // Add others if needed

// Infer the TypeScript type from the Zod schema
export type WriteFilesToolInput = z.infer<typeof writeFilesToolInputSchema>;
type WriteFileItem = z.infer<typeof WriteFileItemSchema>; // Infer internal type

// --- Output Types ---
export interface WriteFileResult {
  path: string;
  success: boolean;
  message?: string;
  error?: string;
  suggestion?: string;
}

// Extend the base output type
export interface WriteFilesToolOutput extends BaseMcpToolOutput {
  error?: string;
  results: WriteFileResult[];
}

// --- Tool Definition (following SDK pattern) ---

export const writeFilesTool: McpTool<typeof writeFilesToolInputSchema, WriteFilesToolOutput> = {
  name: 'writeFilesTool',
  description: 'Writes or appends content to one or more files within the workspace.',
  inputSchema: writeFilesToolInputSchema,

  async execute(input: WriteFilesToolInput, options: McpToolExecuteOptions): Promise<WriteFilesToolOutput> { // Remove workspaceRoot, require options
    const parsed = writeFilesToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      return {
        success: false,
        error: `Input validation failed: ${errorMessages}`,
        results: [],
        content: [],
      };
    }
    const { items, encoding, append } = parsed.data;

    const results: WriteFileResult[] = [];
    let anySuccess = false;

    for (const item of items) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let resolvedPath: string | undefined;

      const operation = append ? 'append' : 'write';

      // Correct argument order: relativePathInput, workspaceRoot
      const validationResult = validateAndResolvePath(item.path, options.workspaceRoot, options?.allowOutsideWorkspace); // Use options.workspaceRoot

      // Check if validation succeeded (result is a string)
      if (typeof validationResult === 'string') {
        resolvedPath = validationResult;

        try {
          // Ensure parent directory exists
          const dir = path.dirname(resolvedPath);
          await mkdir(dir, { recursive: true });

          // Perform write or append
          const writeOptions = { encoding: encoding as BufferEncoding };
          if (append) {
            await appendFile(resolvedPath, item.content, writeOptions);
            message = `Content appended successfully to '${item.path}'.`;
          } else {
            await writeFile(resolvedPath, item.content, writeOptions);
            message = `File written successfully to '${item.path}'.`;
          }
          itemSuccess = true;
          anySuccess = true;
          console.error(message);

        } catch (e: any) {
          itemSuccess = false;
          // Handle errors specifically from file operations
          error = `Failed to ${operation} file '${item.path}': ${e.message}`;
          console.error(error);
          if (e.code === 'EACCES') {
            suggestion = `Check write permissions for the directory containing '${item.path}'.`;
          } else if (e.code === 'EISDIR') {
            suggestion = `The path '${item.path}' points to a directory. Provide a path to a file.`;
          } else if (e.code === 'EROFS') {
            suggestion = `The file system at '${item.path}' is read-only.`;
          } else {
            suggestion = `Check the file path, permissions, and available disk space.`;
          }
        }
        // Push result for this item (success or file operation error)
        results.push({
          path: item.path,
          success: itemSuccess,
          message: itemSuccess ? message : undefined,
          error,
          suggestion: !itemSuccess ? suggestion : undefined,
        });
      } else {
         // Validation failed, result is the error object (or unexpected format)
        error = (validationResult as any)?.error ?? 'Unknown path validation error'; // Access .error
        suggestion = (validationResult as any)?.suggestion ?? 'Review path and workspace settings.';
        console.error(`Path validation failed for ${item.path}: ${error}. Raw validationResult:`, validationResult);
        results.push({ path: item.path, success: false, error, suggestion });
      }
    } // End loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify({
        summary: `Write operation completed. Overall success (at least one): ${anySuccess}`,
        results: results
    }, null, 2); // Pretty-print JSON

    return {
      success: anySuccess, // Keep original success logic
      results: results, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};