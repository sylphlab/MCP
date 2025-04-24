import { cp, stat } from 'node:fs/promises'; // Use named import, add stat
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  // Import values normally
  jsonPart, // Import helper value
  validateAndResolvePath,
} from '@sylphlab/mcp-core';
import type {
  // Import types separately
  ToolExecuteOptions,
  Part,
} from '@sylphlab/mcp-core'; // Import base types and validation util
import { z } from 'zod'; // Import z directly
// import type { z } from 'zod'; // z imported above
import { copyItemsToolInputSchema } from './copyItemsTool.schema.js'; // Import schema (added .js)

// --- Input Types ---

// Infer the TypeScript type from the Zod schema
export type CopyItemsToolInput = z.infer<typeof copyItemsToolInputSchema>;
// Infer the single item type as well

// --- Output Types ---

export interface CopyItemResult {
  /** The source path provided in the input. */
  sourcePath: string;
  /** The destination path provided in the input. */
  destinationPath: string;
  /** Whether the copy operation for this specific item was successful. */
  success: boolean;
  /** Indicates if the operation was a dry run. */
  dryRun: boolean; // Added
  /** Optional message providing more details (e.g., "Copied successfully"). */
  message?: string;
  /** Optional error message if the operation failed for this item. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual copy result (used in outputSchema)
const CopyItemResultSchema = z.object({
  sourcePath: z.string(),
  destinationPath: z.string(),
  success: z.boolean(),
  dryRun: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Extend the base output type
// Removed CopyItemsToolOutput - execute now returns InternalToolExecutionResult

// Define the output schema instance as a constant
const CopyItemsOutputSchema = z.array(CopyItemResultSchema);

// --- Tool Definition using defineTool ---

export const copyItemsTool = defineTool({
  name: 'copyItemsTool',
  description:
    'Copies one or more files or folders within the workspace. Handles recursion. Use relative paths.',
  inputSchema: copyItemsToolInputSchema,
  , // Use the constant schema instance

  execute: async (
    // Core logic passed to defineTool
    input: CopyItemsToolInput,
    options: ToolExecuteOptions,
  ): Promise<Part[]> => {
    // Removed generic

    // Zod validation (throw error on failure)
    const parsed = copyItemsToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      // Return error structure instead of throwing
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items, overwrite } = parsed.data;
    // Determine dryRun status: default false if overwrite is false, true if overwrite is true
    const isDryRun = parsed.data.dryRun ?? overwrite; // Default depends on overwrite safety

    const results: CopyItemResult[] = [];

    for (const item of items) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let sourceFullPath: string;
      let destinationFullPath: string;

      // --- Validate and Resolve Paths ---
      const sourceValidationResult = validateAndResolvePath(
        item.sourcePath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof sourceValidationResult !== 'string') {
        error = sourceValidationResult.error;
        suggestion = sourceValidationResult.suggestion;
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
      sourceFullPath = sourceValidationResult;

      const destValidationResult = validateAndResolvePath(
        item.destinationPath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof destValidationResult !== 'string') {
        error = destValidationResult.error;
        suggestion = destValidationResult.suggestion;
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
      destinationFullPath = destValidationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual item copy errors
      try {
        // Check destination existence for dry run and overwrite logic
        let destinationExists = false;
        try {
          await stat(destinationFullPath);
          destinationExists = true;
        } catch (statError: unknown) {
          if (
            !(
              statError &&
              typeof statError === 'object' &&
              'code' in statError &&
              (statError as { code: unknown }).code === 'ENOENT'
            )
          ) {
            throw statError; // Re-throw unexpected stat errors
          }
        }

        if (destinationExists && !overwrite) {
          throw new Error(
            `Destination path '${item.destinationPath}' already exists and overwrite is false.`,
          );
        }

        if (isDryRun) {
          itemSuccess = true;
          message = `[Dry Run] Would copy '${item.sourcePath}' to '${item.destinationPath}'${destinationExists && overwrite ? ' (overwriting existing)' : ''}.`;
        } else {
          await cp(sourceFullPath, destinationFullPath, {
            recursive: true,
            force: overwrite, // If overwrite is true, force will handle existing destination
            errorOnExist: false, // Let force handle it or the check above handle it
          });
          itemSuccess = true;
          message = `Copied '${item.sourcePath}' to '${item.destinationPath}' successfully${destinationExists && overwrite ? ' (overwrote existing)' : ''}.`;
        }
      } catch (e: unknown) {
        itemSuccess = false;
        const errorMsg = e instanceof Error ? e.message : 'Unknown error'; // Re-add definition
        // Check for system error codes
        if (e && typeof e === 'object' && 'code' in e) {
          const code = (e as { code: unknown }).code;
          if (code === 'ENOENT') {
            error = `Failed to copy '${item.sourcePath}': Source path does not exist.`;
            suggestion = `Verify the source path '${item.sourcePath}' exists and is accessible.`;
          } else if (
            code === 'EEXIST' ||
            errorMsg.includes('already exists and overwrite is false')
          ) {
            // Catch error message too
            error = `Failed to copy to '${item.destinationPath}': Destination path already exists and overwrite is false.`;
            suggestion = `Enable the 'overwrite' option or choose a different destination path.`;
          }
        }
        // If no specific code matched or it wasn't a system error, use the general message
        if (!error) {
          error = `Failed to copy '${item.sourcePath}' to '${item.destinationPath}': ${errorMsg}`;
          suggestion = 'Check file paths, permissions, and available disk space.';
        }
      }

      // Push result for this item
      results.push({
        sourcePath: item.sourcePath,
        destinationPath: item.destinationPath,
        success: itemSuccess, // Reflects success of the operation (or simulation)
        dryRun: isDryRun, // Indicate if it was a dry run
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End for loop

    // Construct parts array
    return [jsonPart(results, CopyItemsOutputSchema)];
  },
});
