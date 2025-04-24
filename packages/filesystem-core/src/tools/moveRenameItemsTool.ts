import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/mcp-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import { moveRenameItemsToolInputSchema } from './moveRenameItemsTool.schema.js';

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
  /** Indicates if the operation was a dry run. */
  dryRun: boolean;
  /** Optional message providing more details. */
  message?: string;
  /** Optional error message if the operation failed for this item. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual move/rename result (used in outputSchema)
const MoveRenameItemResultSchema = z.object({
  sourcePath: z.string(),
  destinationPath: z.string(),
  success: z.boolean(),
  dryRun: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant
const MoveRenameItemsOutputSchema = z.array(MoveRenameItemResultSchema);

// --- Tool Definition using defineTool ---

export const moveRenameItemsTool = defineTool({
  name: 'moveRenameItemsTool',
  description:
    'Moves or renames one or more files or folders within the workspace. Use relative paths.',
  inputSchema: moveRenameItemsToolInputSchema,
  ,

  execute: async (
    input: MoveRenameItemsToolInput,
    options: ToolExecuteOptions,
  ): Promise<Part[]> => {
    // Zod validation (throw error on failure)
    const parsed = moveRenameItemsToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items, overwrite } = parsed.data;
    // Determine dryRun status: default false if overwrite is false, true if overwrite is true
    const isDryRun = parsed.data.dryRun ?? overwrite;

    const results: MoveRenameItemResult[] = [];

    for (const item of items) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let sourceFullPath: string | undefined;
      let destinationFullPath: string | undefined;

      // --- Validate Paths ---
      const sourceValidation = validateAndResolvePath(
        item.sourcePath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof sourceValidation !== 'string') {
        error = `Source path validation failed: ${sourceValidation.error}`;
        suggestion = sourceValidation.suggestion;
        results.push({
          // Push error result immediately
          sourcePath: item.sourcePath,
          destinationPath: item.destinationPath,
          success: false,
          dryRun: isDryRun,
          error,
          suggestion,
        });
        continue; // Skip this item
      }
      sourceFullPath = sourceValidation;

      // Only validate destination if source is valid
      const destValidation = validateAndResolvePath(
        item.destinationPath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof destValidation !== 'string') {
        error = `Destination path validation failed: ${destValidation.error}`;
        suggestion = destValidation.suggestion;
        results.push({
          sourcePath: item.sourcePath,
          destinationPath: item.destinationPath,
          success: false,
          dryRun: isDryRun,
          error,
          suggestion,
        });
        continue; // Skip this item
      }
      destinationFullPath = destValidation;
      // --- End Path Validation ---

      // Check if paths are the same after validation
      if (sourceFullPath === destinationFullPath) {
        error = `Source and destination paths resolve to the same location: '${sourceFullPath}'`;
        suggestion = 'Provide different source and destination paths.';
        results.push({
          sourcePath: item.sourcePath,
          destinationPath: item.destinationPath,
          success: false,
          dryRun: isDryRun,
          error,
          suggestion,
        });
        continue; // Skip this item
      }

      // Proceed only if paths are valid and different
      try {
        const destDir = path.dirname(destinationFullPath);
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
            // Only remove if not dry run
            if (!isDryRun) {
              await rm(destinationFullPath, { recursive: true, force: true });
            }
          } else {
            throw new Error(
              `Destination path '${item.destinationPath}' already exists and overwrite is false.`,
            );
          }
        }

        if (isDryRun) {
          itemSuccess = true;
          message = `[Dry Run] Would move/rename '${item.sourcePath}' to '${item.destinationPath}'${destinationExists && overwrite ? ' (overwriting existing)' : ''}.`;
        } else {
          // Actual operation
          await mkdir(destDir, { recursive: true }); // Ensure dest dir exists before rename
          await rename(sourceFullPath, destinationFullPath);
          itemSuccess = true;
          message = `Moved/Renamed '${item.sourcePath}' to '${item.destinationPath}' successfully${destinationExists && overwrite ? ' (overwrote existing)' : ''}.`;
        }
      } catch (e: unknown) {
        itemSuccess = false;
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
          suggestion =
            'Suggestion: Check file system permissions for both source and destination paths.';
        } else {
          suggestion = 'Suggestion: Check file paths, permissions, and disk space.';
        }
      }

      // Push result for this item
      results.push({
        sourcePath: item.sourcePath,
        destinationPath: item.destinationPath,
        success: itemSuccess,
        dryRun: isDryRun,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End for loop

    // Return the parts array directly
    return [jsonPart(results, MoveRenameItemsOutputSchema)];
  },
});
