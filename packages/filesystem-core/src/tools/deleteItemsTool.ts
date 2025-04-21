import { rm } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
  PathValidationError, // PathValidationError might not be needed directly
  validateAndResolvePath,
} from '@sylphlab/mcp-core';
import trash from 'trash';
import type { z } from 'zod';
import { deleteItemsToolInputSchema } from './deleteItemsTool.schema.js'; // Import schema (added .js)

// Infer the TypeScript type from the Zod schema
export type DeleteItemsToolInput = z.infer<typeof deleteItemsToolInputSchema>;

// --- Output Types ---
export interface DeleteItemResult {
  path: string;
  success: boolean;
  message?: string;
  error?: string;
  suggestion?: string;
}

// Extend the base output type
export interface DeleteItemsToolOutput extends BaseMcpToolOutput {
  error?: string;
  results: DeleteItemResult[];
}

// --- Tool Definition using defineTool ---
export const deleteItemsTool = defineTool({
  name: 'deleteItemsTool',
  description:
    'Deletes specified files or directories (supports globs - TODO: implement glob support). Uses trash by default.',
  inputSchema: deleteItemsToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: DeleteItemsToolInput,
    options: McpToolExecuteOptions,
  ): Promise<DeleteItemsToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = deleteItemsToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      // Return error structure instead of throwing
      return {
        success: false,
        error: `Input validation failed: ${errorMessages}`,
        results: [], // Ensure results is an empty array on validation failure
        content: [{ type: 'text', text: `Input validation failed: ${errorMessages}` }],
      };
    }
    const { paths: inputPaths, recursive, useTrash } = parsed.data;

    // TODO: Implement glob expansion for inputPaths if needed
    const resolvedPaths = inputPaths; // Placeholder for now

    const results: DeleteItemResult[] = [];
    let overallSuccess = true; // Assume success until a failure occurs

    for (const itemPath of resolvedPaths) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      const deleteMethod = useTrash ? 'trash' : 'delete permanently';
      let fullPath: string;

      // --- Validate and Resolve Path ---
      const validationResult = validateAndResolvePath(
        itemPath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = validationResult.error;
        suggestion = validationResult.suggestion;
        overallSuccess = false; // Mark overall as failed if path validation fails
        results.push({ path: itemPath, success: false, error, suggestion });
        continue; // Skip to next itemPath
      }
      fullPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual item deletion errors
      try {
        if (useTrash) {
          await trash(fullPath);
        } else {
          // force: true ignores errors if path doesn't exist, which is desired here
          await rm(fullPath, { recursive: recursive, force: true });
        }
        itemSuccess = true;
        message = `Item '${itemPath}' deleted (${deleteMethod}) successfully.`;
      } catch (e: unknown) {
        itemSuccess = false;
        overallSuccess = false; // Mark overall as failed if any item fails
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        error = `Failed to ${deleteMethod} '${itemPath}': ${errorMsg}`;
        suggestion = `Check permissions for '${itemPath}' and its parent directories. Ensure the file/folder exists if using 'rm' without 'force: true'.`;
      }

      // Push result for this item
      results.push({
        path: itemPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End for loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Delete operation completed. Overall success: ${overallSuccess}`,
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
// export type { DeleteItemsToolInput, DeleteItemsToolOutput, DeleteItemResult }; // Removed duplicate export
