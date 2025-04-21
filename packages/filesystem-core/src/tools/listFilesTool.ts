import type { Stats } from 'node:fs'; // Import Stats type
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core'; // Import from package root
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly if only defineTool is used
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
  PathValidationError, // PathValidationError might not be needed directly
  validateAndResolvePath,
} from '@sylphlab/mcp-core'; // Import base types and validation util
import type { z } from 'zod';
import { listFilesToolInputSchema } from './listFilesTool.schema.js'; // Import schema (added .js)

// Infer the TypeScript type from the Zod schema
export type ListFilesToolInput = z.infer<typeof listFilesToolInputSchema>;

// --- Output Types ---
export interface ListEntry {
  /** Name of the file or directory. */
  name: string;
  /** Relative path from the workspace root. */
  path: string;
  /** True if the entry is a directory. */
  isDirectory: boolean;
  /** True if the entry is a file. */
  isFile: boolean;
  /** Optional file system stats (if includeStats was true). */
  stat?: Stats;
}

export interface PathListResult {
  /** Whether listing was successful for this path. */
  success: boolean;
  /** Array of entries found within the path. */
  entries?: ListEntry[];
  /** Optional error message if listing failed for this path. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Extend the base output type
export interface ListFilesToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true if at least one path was listed successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Object where keys are the input paths and values are the listing results. */
  results: { [inputPath: string]: PathListResult };
}

// --- Helper Function for Recursive Listing ---
async function listDirectoryRecursive(
  dirPath: string,
  workspaceRoot: string,
  currentDepth: number,
  maxDepth: number | undefined,
  includeStats: boolean,
): Promise<ListEntry[]> {
  let entries: ListEntry[] = [];
  const dirents = await readdir(dirPath, { withFileTypes: true });

  for (const dirent of dirents) {
    const fullPath = path.join(dirPath, dirent.name);
    const relativePath = path.relative(workspaceRoot, fullPath);
    let entryStat: Stats | undefined = undefined;

    if (includeStats) {
      try {
        // Use lstat to avoid following symlinks if stats are requested
        entryStat = await stat(fullPath);
      } catch (_statError: unknown) {
        // Continue without stats if stat fails
      }
    }

    const isDirectory = dirent.isDirectory();
    const isFile = dirent.isFile();

    entries.push({
      name: dirent.name,
      path: relativePath,
      isDirectory: isDirectory,
      isFile: isFile,
      stat: entryStat,
    });

    if (isDirectory && (maxDepth === undefined || currentDepth < maxDepth)) {
      try {
        const subEntries = await listDirectoryRecursive(
          fullPath,
          workspaceRoot,
          currentDepth + 1,
          maxDepth,
          includeStats,
        );
        entries = entries.concat(subEntries);
      } catch (_recursiveError: unknown) {
        // Include the directory entry itself even if listing its contents failed
      }
    }
  }
  return entries;
}

// --- Tool Definition using defineTool ---

export const listFilesTool = defineTool({
  name: 'listFilesTool',
  description: 'Lists files and directories within one or more specified paths in the workspace.',
  inputSchema: listFilesToolInputSchema,

  execute: async ( // The core logic is now the execute function passed to defineTool
    input: ListFilesToolInput,
    options: McpToolExecuteOptions,
  ): Promise<ListFilesToolOutput> => { // Still returns the specific output type

    // Zod validation (kept inside, throw error on failure)
    const parsed = listFilesToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      // Throw error for defineTool wrapper to catch
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { paths: inputPaths, recursive, maxDepth, includeStats } = parsed.data;

    const results: { [inputPath: string]: PathListResult } = {};
    let anySuccess = false;

    for (const inputPath of inputPaths) {
      let pathSuccess = false;
      let pathEntries: ListEntry[] | undefined = undefined;
      let pathError: string | undefined;
      let pathSuggestion: string | undefined;
      let fullPath: string;

      // --- Validate and Resolve Path ---
      const validationResult = validateAndResolvePath(
        inputPath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        pathError = validationResult.error;
        pathSuggestion = validationResult.suggestion;
        results[inputPath] = { success: false, error: pathError, suggestion: pathSuggestion };
        continue; // Skip to next inputPath
      }
      fullPath = validationResult; // Path is valid and resolved
      // --- End Path Validation ---

      // Removed the main try/catch block, let defineTool handle errors
      try { // Keep try/catch *within* the loop for path-specific errors we want to report gracefully
          const pathStat = await stat(fullPath);
          if (!pathStat.isDirectory()) {
            throw new Error(`Path '${inputPath}' is not a directory.`);
          }

          if (recursive) {
              pathEntries = await listDirectoryRecursive(
                fullPath,
                options.workspaceRoot,
                0,
                maxDepth,
                includeStats,
              );
          } else {
            // Non-recursive logic
            const dirents = await readdir(fullPath, { withFileTypes: true });
            pathEntries = [];
            for (const dirent of dirents) {
              const entryFullPath = path.join(fullPath, dirent.name);
              const entryRelativePath = path.relative(options.workspaceRoot, entryFullPath);
              let entryStat: Stats | undefined = undefined;
              if (includeStats) {
                try { // Keep try/catch for individual stat calls
                  entryStat = await stat(entryFullPath);
                } catch (_statError: unknown) {}
              }
              pathEntries.push({
                name: dirent.name,
                path: entryRelativePath,
                isDirectory: dirent.isDirectory(),
                isFile: dirent.isFile(),
                stat: entryStat,
              });
            }
          }
          pathSuccess = true;
          anySuccess = true; // Mark overall success if at least one works

      } catch (e: unknown) {
          // Handle path-specific errors gracefully within the loop
          pathSuccess = false;
          let errorCode: string | null = null;
          let errorMsg = 'Unknown error';

          if (e && typeof e === 'object') {
            if ('code' in e) {
              errorCode = String((e as { code: unknown }).code);
            }
          }
          if (e instanceof Error) {
            errorMsg = e.message;
          }

          pathError = `Error listing path '${inputPath}': ${errorMsg}`;
          if (errorCode === 'ENOENT') {
            pathSuggestion = `Ensure the path '${inputPath}' exists.`;
          } else if (errorMsg.includes('is not a directory')) {
            pathSuggestion = `The path '${inputPath}' points to a file, not a directory. Provide a directory path.`;
          } else {
            pathSuggestion = `Check permissions for '${inputPath}' and ensure it is a valid directory path.`;
          }
      }


      // Assign result for this path
      results[inputPath] = {
        success: pathSuccess,
        entries: pathEntries,
        error: pathError,
        suggestion: pathSuggestion,
      };
    } // End for loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `List operation completed. Overall success (at least one): ${anySuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure, defineTool wrapper handles BaseMcpToolOutput aspects
    return {
      success: anySuccess,
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported for consumers
// export type { ListFilesToolInput, ListFilesToolOutput, ListEntry, PathListResult }; // Removed duplicate export
