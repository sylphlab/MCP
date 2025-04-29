import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/tools-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import trash from 'trash';
import { z } from 'zod';
import { deleteItemsToolInputSchema } from './deleteItemsTool.schema.js';

// Infer the TypeScript type from the Zod schema
export type DeleteItemsToolInput = z.infer<typeof deleteItemsToolInputSchema>;

// --- Output Types ---
export interface DeleteItemResult {
  path: string;
  success: boolean;
  /** Indicates if the operation was a dry run. */
  dryRun: boolean;
  message?: string;
  error?: string;
  suggestion?: string;
}

// Zod Schema for the individual delete result (used in outputSchema)
const DeleteItemResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  dryRun: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant
const DeleteItemsOutputSchema = z.array(DeleteItemResultSchema);

// --- Tool Definition using defineTool ---
import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

export const deleteItemsTool = defineTool({
  name: 'delete-items',
  description:
    'Deletes specified files or directories (supports globs - TODO: implement glob support). Uses trash by default.',
  inputSchema: deleteItemsToolInputSchema,
  contextSchema: BaseContextSchema, // Add context schema

  execute: async (
    // Use new signature with destructuring
    { context, args }: { context: ToolExecuteOptions; args: DeleteItemsToolInput }
  ): Promise<Part[]> => {
    // Zod validation (throw error on failure)
    const parsed = deleteItemsToolInputSchema.safeParse(args); // Validate args
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { paths: inputPaths, recursive, useTrash } = parsed.data; // Get data from parsed args
    // Deletion is unsafe, default dryRun to true
    const isDryRun = parsed.data.dryRun ?? true;
    // TODO: Implement glob expansion for inputPaths if needed
    const resolvedPaths = inputPaths; // Placeholder for now

    const results: DeleteItemResult[] = [];

    for (const itemPath of resolvedPaths) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      const deleteMethod = useTrash ? 'trash' : 'delete permanently';
      let fullPath: string;

      // --- Validate and Resolve Path ---
      // Use context for workspaceRoot and allowOutsideWorkspace
      const validationResult = validateAndResolvePath(
        itemPath,
        context.workspaceRoot,
        context?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = validationResult.error;
        suggestion = validationResult.suggestion;
        results.push({ path: itemPath, success: false, dryRun: isDryRun, error, suggestion });
        continue; // Skip to next itemPath
      }
      fullPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual item deletion errors
      try {
        if (useTrash) {
          // Check existence for dry run
          try {
            await stat(fullPath); // Check if path exists
            if (isDryRun) {
              message = `[Dry Run] Would move '${itemPath}' to trash.`;
            } else {
              await trash(fullPath);
              message = `Item '${itemPath}' moved to trash successfully.`;
            }
            itemSuccess = true;
          } catch (statError: unknown) {
            if (
              statError &&
              typeof statError === 'object' &&
              'code' in statError &&
              (statError as { code: unknown }).code === 'ENOENT'
            ) {
              // If path doesn't exist, it's technically not an error for deletion intent
              itemSuccess = true;
              message = `Item '${itemPath}' does not exist, no action needed.`;
            } else {
              throw statError; // Re-throw other stat errors
            }
          }
        } else {
          // force: true ignores errors if path doesn't exist, which is desired here
          if (isDryRun) {
            // Check existence for dry run message clarity
            try {
              await stat(fullPath);
              message = `[Dry Run] Would delete '${itemPath}' permanently (recursive: ${recursive}).`;
            } catch (statError: unknown) {
              if (
                statError &&
                typeof statError === 'object' &&
                'code' in statError &&
                (statError as { code: unknown }).code === 'ENOENT'
              ) {
                message = `[Dry Run] Item '${itemPath}' does not exist, no action needed.`;
              } else {
                // Still report success for dry run even if stat fails unexpectedly
                message = `[Dry Run] Would attempt to delete '${itemPath}' permanently (recursive: ${recursive}). Stat check failed: ${statError instanceof Error ? statError.message : 'Unknown'}`;
              }
            }
            itemSuccess = true;
          } else {
            await rm(fullPath, { recursive: recursive, force: true });
            message = `Item '${itemPath}' deleted permanently (recursive: ${recursive}) successfully.`;
            itemSuccess = true;
          }
        }
      } catch (e: unknown) {
        itemSuccess = false;
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        error = `Failed to ${deleteMethod} '${itemPath}': ${errorMsg}`;
        suggestion = `Check permissions for '${itemPath}' and its parent directories. Ensure the file/folder exists if using 'rm' without 'force: true'.`;
      }

      // Push result for this item
      results.push({
        path: itemPath,
        success: itemSuccess,
        dryRun: isDryRun,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End for loop

    return [jsonPart(results, DeleteItemsOutputSchema)];
  },
});
