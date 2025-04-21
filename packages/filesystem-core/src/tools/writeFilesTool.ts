import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
  validateAndResolvePath,
} from '@sylphlab/mcp-core'; // Import base types and validation util
import type { z } from 'zod';
import { type WriteFileItemSchema, writeFilesToolInputSchema } from './writeFilesTool.schema.js'; // Import schema (added .js)

// Define BufferEncoding type for Zod schema
type BufferEncoding = 'utf-8' | 'base64'; // Add others if needed

// Infer the TypeScript type from the Zod schema
export type WriteFilesToolInput = z.infer<typeof writeFilesToolInputSchema>;

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

// --- Tool Definition using defineTool ---

export const writeFilesTool = defineTool({
  name: 'writeFilesTool',
  description: 'Writes or appends content to one or more files within the workspace.',
  inputSchema: writeFilesToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: WriteFilesToolInput,
    options: McpToolExecuteOptions,
  ): Promise<WriteFilesToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = writeFilesToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items, encoding, append } = parsed.data;

    const results: WriteFileResult[] = [];
    let anySuccess = false; // True if at least one file is written/appended successfully

    for (const item of items) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let resolvedPath: string | undefined;
      const operation = append ? 'append' : 'write';

      // --- Validate Path ---
      const validationResult = validateAndResolvePath(
        item.path, options.workspaceRoot, options?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = validationResult?.error ?? 'Unknown path validation error';
        suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
        results.push({ path: item.path, success: false, error, suggestion });
        // Don't mark overallSuccess as false for path validation failure
        continue; // Skip this item
      }
      resolvedPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual file write/append errors
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
        anySuccess = true; // Mark overall success if at least one works

      } catch (e: unknown) {
        itemSuccess = false;
        // Don't mark overallSuccess as false for individual write failure
        let errorCode: string | null = null;
        let errorMsg = 'Unknown error';

        if (e && typeof e === 'object') {
          if ('code' in e) errorCode = String((e as { code: unknown }).code);
        }
        if (e instanceof Error) errorMsg = e.message;

        error = `Failed to ${operation} file '${item.path}': ${errorMsg}`;
        if (errorCode === 'EACCES') {
          suggestion = `Check write permissions for the directory containing '${item.path}'.`;
        } else if (errorCode === 'EISDIR') {
          suggestion = `The path '${item.path}' points to a directory. Provide a path to a file.`;
        } else if (errorCode === 'EROFS') {
          suggestion = `The file system at '${item.path}' is read-only.`;
        } else {
          suggestion = 'Check the file path, permissions, and available disk space.';
        }
      }

      // Push result for this item
      results.push({
        path: item.path, success: itemSuccess, message: itemSuccess ? message : undefined, error, suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Write operation completed. Overall success (at least one): ${anySuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: anySuccess, // Success is true if at least one write/append succeeded
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { WriteFilesToolInput, WriteFilesToolOutput, WriteFileResult }; // Removed duplicate export
