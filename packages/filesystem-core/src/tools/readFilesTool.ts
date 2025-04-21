import type { Stats } from 'node:fs'; // Import Stats type
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
  PathValidationError, // PathValidationError might not be needed directly
  validateAndResolvePath,
} from '@sylphlab/mcp-core'; // Import base types and validation util
import type { z } from 'zod';
import { readFilesToolInputSchema } from './readFilesTool.schema.js'; // Import schema (added .js)

// Infer the TypeScript type from the Zod schema
export type ReadFilesToolInput = z.infer<typeof readFilesToolInputSchema>;

// --- Output Types ---
export interface ReadFileResult {
  /** The file path provided in the input. */
  path: string;
  /** Whether the read operation for this specific file was successful. */
  success: boolean;
  /** The content of the file, as a string (respecting encoding). */
  content?: string;
  /** Optional file system stats (if includeStats was true). */
  stat?: Stats;
  /** Optional error message if the operation failed for this file. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
  // encodingUsed?: 'utf-8' | 'base64'; // Could add if needed
}

// Extend the base output type
export interface ReadFilesToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true if at least one file was read successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each file read operation. */
  results: ReadFileResult[];
}

// --- Tool Definition using defineTool ---

export const readFilesTool = defineTool({
  name: 'readFilesTool',
  description: 'Reads the content of one or more files within the workspace.',
  inputSchema: readFilesToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: ReadFilesToolInput,
    options: McpToolExecuteOptions,
  ): Promise<ReadFilesToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = readFilesToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { paths: inputPaths, encoding, includeStats } = parsed.data;

    const results: ReadFileResult[] = [];
    let anySuccess = false; // True if at least one file is read successfully

    for (const itemPath of inputPaths) {
      let itemSuccess = false;
      let content: string | undefined = undefined;
      let itemStat: Stats | undefined = undefined;
      let error: string | undefined;
      let suggestionForError: string | undefined;
      let fullPath: string | undefined;

      // --- Validate Path ---
      const validationResult = validateAndResolvePath(
        itemPath, options.workspaceRoot, options?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = `Path validation failed: ${validationResult.error}`;
        suggestionForError = validationResult.suggestion;
        results.push({ path: itemPath, success: false, error, suggestion: suggestionForError });
        continue; // Skip to next itemPath
      }
      fullPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual file read errors
      try {
        // Optionally get stats first
        if (includeStats) {
          itemStat = await stat(fullPath);
          if (!itemStat.isFile()) {
            throw new Error(`Path '${itemPath}' is not a file.`);
          }
        }

        // Read the file content with specified encoding
        const fileBuffer = await readFile(fullPath);
        content = fileBuffer.toString(encoding);

        itemSuccess = true;
        anySuccess = true; // Mark overall success if at least one works

      } catch (e: unknown) {
        itemSuccess = false;
        let errorCode: string | null = null;
        let errorMsg = 'Unknown error';

        if (e && typeof e === 'object') {
          if ('code' in e) errorCode = String((e as { code: unknown }).code);
        }
        if (e instanceof Error) errorMsg = e.message;

        // Provide specific errors based on code
        if (errorCode === 'ENOENT') {
          error = `Failed to read '${itemPath}': File not found.`;
        } else if (errorCode === 'EISDIR') {
          error = `Failed to read '${itemPath}': Path is a directory, not a file.`;
        } else {
          error = `Failed to read '${itemPath}': ${errorMsg}`;
        }

        // Add suggestion based on error code or message
        if (errorCode === 'ENOENT') {
          const parentDir = path.dirname(itemPath);
          suggestionForError = `Ensure the file path '${itemPath}' is correct and the file exists. You could try listing the directory contents using listFilesTool on '${parentDir === '.' ? '.' : parentDir}' to check available files.`;
        } else if (errorCode === 'EISDIR' || errorMsg.includes('is not a file')) {
          suggestionForError = `The path '${itemPath}' points to a directory. Provide a path to a file.`;
        } else if (errorCode === 'EACCES') {
          suggestionForError = `Check read permissions for the file '${itemPath}'.`;
        } else {
          suggestionForError = 'Check the file path and permissions.';
        }
      }

      // Push result for this file
      results.push({
        path: itemPath,
        success: itemSuccess,
        content,
        stat: itemStat,
        error,
        suggestion: !itemSuccess ? suggestionForError : undefined,
      });
    } // End for loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Read operation completed. Overall success (at least one): ${anySuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: anySuccess, // Success is true if at least one file was read
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { ReadFilesToolInput, ReadFilesToolOutput, ReadFileResult }; // Removed duplicate export
