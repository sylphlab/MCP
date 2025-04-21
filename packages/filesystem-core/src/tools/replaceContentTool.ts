import { readFile, writeFile } from 'node:fs/promises';
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
import glob from 'fast-glob'; // Import fast-glob
import type { z } from 'zod';
import {
  type ReplaceOperationSchema,
  replaceContentToolInputSchema,
} from './replaceContentTool.schema.js'; // Import schema (added .js)

// Infer the TypeScript type from the Zod schema
export type ReplaceContentToolInput = z.infer<typeof replaceContentToolInputSchema>;
export type ReplaceOperation = z.infer<typeof ReplaceOperationSchema>;

// --- Output Types ---
export interface FileReplaceResult {
  /** The file path processed (relative to workspace root). */
  path: string;
  /** Whether the replacement operations for this specific file were successful. */
  success: boolean;
  /** Number of replacements made in this file across all operations. */
  replacementsMade: number;
  /** True if the file content was actually changed and written back. */
  contentChanged: boolean;
  /** Optional error message if processing failed for this file. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Extend the base output type
export interface ReplaceContentToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true only if ALL matched files processed successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each file processed. */
  results: FileReplaceResult[];
}

// --- Tool Definition using defineTool ---

export const replaceContentTool = defineTool({
  name: 'replaceContentTool',
  description: 'Performs search and replace operations across multiple files (supports globs).',
  inputSchema: replaceContentToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: ReplaceContentToolInput,
    options: McpToolExecuteOptions,
  ): Promise<ReplaceContentToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = replaceContentToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { paths: pathPatterns, operations } = parsed.data;

    const fileResults: FileReplaceResult[] = [];
    let overallSuccess = true; // Assume success until a failure occurs
    let resolvedFilePaths: string[] = [];

    // Keep try/catch for glob errors, as this is setup before the main loop
    try {
      resolvedFilePaths = await glob(pathPatterns, {
        cwd: options.workspaceRoot,
        absolute: false,
        onlyFiles: true,
        dot: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });

      if (resolvedFilePaths.length === 0) {
        // If no files match, it's not an error, just return empty results
        return { success: true, results: [], content: [] };
      }
    } catch (globError: unknown) {
      // If glob itself fails, throw an error for defineTool to catch
      const errorMsg = globError instanceof Error ? globError.message : 'Unknown glob error';
      throw new Error(`Glob pattern error: ${errorMsg}`);
    }

    // Removed the outermost try/catch block for file processing loop

    for (const relativeFilePath of resolvedFilePaths) {
      const fullPath = path.resolve(options.workspaceRoot, relativeFilePath);
      let fileSuccess = true;
      let fileError: string | undefined;
      let totalReplacementsMade = 0;
      let contentChanged = false;
      let suggestion: string | undefined;

      // --- Path Validation (Keep this check) ---
      const relativeCheck = path.relative(options.workspaceRoot, fullPath);
      if (
        !options?.allowOutsideWorkspace &&
        (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck))
      ) {
        fileError = `Path validation failed: Matched file '${relativeFilePath}' is outside workspace root.`;
        suggestion = `Ensure the path pattern '${pathPatterns.join(', ')}' does not resolve to paths outside the workspace.`;
        fileSuccess = false;
        overallSuccess = false;
        fileResults.push({
          path: relativeFilePath, success: false, replacementsMade: 0, contentChanged: false, error: fileError, suggestion,
        });
        continue; // Skip this file
      }
      // --- End Path Validation ---

      // Keep try/catch for individual file processing errors
      try {
        const originalContent = await readFile(fullPath, 'utf-8');
        let currentContent = originalContent;

        for (const op of operations) {
          let operationReplacements = 0;
          let tempContent = '';
          if (op.isRegex) {
            try { // Keep try/catch for regex compilation errors
              const regex = new RegExp(op.search, op.flags ?? '');
              tempContent = currentContent.replace(regex, op.replace);
              if (tempContent !== currentContent) {
                operationReplacements = (currentContent.match(regex) || []).length;
              }
            } catch (e: unknown) {
              const errorMsg = e instanceof Error ? e.message : 'Unknown regex error';
              // Throw specific error for this operation within the file processing try/catch
              throw new Error(`Invalid regex '${op.search}': ${errorMsg}`);
            }
          } else {
            const searchString = op.search;
            operationReplacements = currentContent.split(searchString).length - 1;
            if (operationReplacements > 0) {
              tempContent = currentContent.replaceAll(searchString, op.replace);
            } else {
              tempContent = currentContent;
            }
          }

          if (tempContent !== currentContent) {
            currentContent = tempContent;
            totalReplacementsMade += operationReplacements;
          }
        } // End operations loop

        if (currentContent !== originalContent) {
          await writeFile(fullPath, currentContent, 'utf-8');
          contentChanged = true;
        }

      } catch (e: unknown) {
        // Handle file read/write or regex errors gracefully
        fileSuccess = false;
        overallSuccess = false;
        let errorCode: string | null = null;
        let errorMsg = 'Unknown error';

        if (e && typeof e === 'object') {
          if ('code' in e) errorCode = String((e as { code: unknown }).code);
        }
        if (e instanceof Error) errorMsg = e.message;

        fileError = `Error processing file '${relativeFilePath}': ${errorMsg}`;
        if (errorCode === 'ENOENT') {
          suggestion = `Ensure the file path '${relativeFilePath}' is correct and the file exists.`;
        } else if (errorCode === 'EACCES') {
          suggestion = `Check read/write permissions for the file '${relativeFilePath}'.`;
        } else if (errorMsg.includes('Invalid regex')) {
          suggestion = 'Verify the regex pattern syntax in the operations.';
        } else {
          suggestion = 'Check file path, permissions, and operation details.';
        }
      }

      // Push result for this file
      fileResults.push({
        path: relativeFilePath, success: fileSuccess, replacementsMade: totalReplacementsMade, contentChanged: contentChanged, error: fileError, suggestion: !fileSuccess ? suggestion : undefined,
      });
    } // End files loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Replace operation completed. Overall success: ${overallSuccess}`,
        results: fileResults,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess,
      results: fileResults,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { ReplaceContentToolInput, ReplaceContentToolOutput, FileReplaceResult, ReplaceOperation }; // Removed duplicate export
