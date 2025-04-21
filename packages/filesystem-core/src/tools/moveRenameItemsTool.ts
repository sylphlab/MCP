import { mkdir, rename, rm, stat } from 'node:fs/promises';
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
import {
  type MoveRenameItemSchema,
  moveRenameItemsToolInputSchema,
} from './moveRenameItemsTool.schema.js'; // Import schema (added .js)

// Infer the TypeScript type from the Zod schema
export type MoveRenameItemsToolInput = z.infer<typeof moveRenameItemsToolInputSchema>;

// --- Output Types ---
export interface MoveRenameItemResult {
  /** The source path provided in the input. */
  sourcePath: string;
  /** The destination path provided in the input. */
  destinationPath: string;
  /** Whether the move/rename operation for this specific item was successful. */
  success: boolean;
  /** Optional message providing more details. */
  message?: string;
  /** Optional error message if the operation failed for this item. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
  // Removed duplicate suggestion property
}

// Extend the base output type
export interface MoveRenameItemsToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true only if ALL items moved/renamed successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each move/rename operation. */
  results: MoveRenameItemResult[];
}

// --- Tool Definition using defineTool ---

export const moveRenameItemsTool = defineTool({
  name: 'moveRenameItemsTool',
  description:
    'Moves or renames one or more files or folders within the workspace. Use relative paths.',
  inputSchema: moveRenameItemsToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: MoveRenameItemsToolInput,
    options: McpToolExecuteOptions,
  ): Promise<MoveRenameItemsToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = moveRenameItemsToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items, overwrite } = parsed.data;

    const results: MoveRenameItemResult[] = [];
    let overallSuccess = true; // Assume success until a failure occurs

    for (const item of items) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let sourceFullPath: string | undefined;
      let destinationFullPath: string | undefined;

      // --- Validate Paths ---
      const sourceValidation = validateAndResolvePath(
        item.sourcePath, options.workspaceRoot, options?.allowOutsideWorkspace,
      );
      if (typeof sourceValidation !== 'string') {
        error = `Source path validation failed: ${sourceValidation.error}`;
        suggestion = sourceValidation.suggestion;
        overallSuccess = false;
      } else {
        sourceFullPath = sourceValidation;
      }

      if (!error) { // Only validate destination if source is valid
        const destValidation = validateAndResolvePath(
          item.destinationPath, options.workspaceRoot, options?.allowOutsideWorkspace,
        );
        if (typeof destValidation !== 'string') {
          error = `Destination path validation failed: ${destValidation.error}`;
          suggestion = destValidation.suggestion;
          overallSuccess = false;
        } else {
          destinationFullPath = destValidation;
        }
      }
      // --- End Path Validation ---

      // Check if paths are the same after validation
      if (!error && sourceFullPath === destinationFullPath) {
        error = `Source and destination paths resolve to the same location: '${sourceFullPath}'`;
        suggestion = 'Provide different source and destination paths.';
        overallSuccess = false;
      }

      // Proceed only if paths are valid and different
      if (!error && sourceFullPath && destinationFullPath) {
        // Keep try/catch for individual item move/rename errors
        try {
          const destDir = path.dirname(destinationFullPath);
          await mkdir(destDir, { recursive: true });

          let destinationExists = false;
          try {
            await stat(destinationFullPath);
            destinationExists = true;
          } catch (statError: unknown) {
            if (statError && typeof statError === 'object' && 'code' in statError) {
              if ((statError as { code: unknown }).code !== 'ENOENT') throw statError;
            } else {
              throw statError;
            }
          }

          if (destinationExists) {
            if (overwrite) {
              await rm(destinationFullPath, { recursive: true, force: true });
            } else {
              throw new Error(`Destination path '${item.destinationPath}' already exists and overwrite is false.`);
            }
          }

          await rename(sourceFullPath, destinationFullPath);
          itemSuccess = true;
          message = `Moved/Renamed '${item.sourcePath}' to '${item.destinationPath}' successfully.`;

        } catch (e: unknown) {
          itemSuccess = false;
          overallSuccess = false; // Mark overall as failed if any item fails
          let errorCode: string | null = null;
          let errorMsg = 'Unknown error';

          if (e && typeof e === 'object') {
            if ('code' in e) errorCode = String((e as { code: unknown }).code);
          }
          if (e instanceof Error) errorMsg = e.message;

          error = `Failed to move/rename '${item.sourcePath}' to '${item.destinationPath}': ${errorMsg}`;
          if (errorCode === 'ENOENT') {
            suggestion = `Suggestion: Verify the source path '${item.sourcePath}' exists.`;
          } else if (errorMsg.includes('already exists and overwrite is false')) {
            suggestion = `Suggestion: Enable the 'overwrite' option or choose a different destination path.`;
          } else if (errorCode === 'EPERM' || errorCode === 'EACCES') {
            suggestion = 'Suggestion: Check file system permissions for both source and destination paths.';
          } else {
            suggestion = 'Suggestion: Check file paths, permissions, and disk space.';
          }
        }
      } // End if (!error && sourceFullPath && destinationFullPath)

      // Push result for this item
      results.push({
        sourcePath: item.sourcePath,
        destinationPath: item.destinationPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End for loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Move/Rename operation completed. Overall success: ${overallSuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess,
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { MoveRenameItemsToolInput, MoveRenameItemsToolOutput, MoveRenameItemResult }; // Removed duplicate export
