import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import trash from 'trash';
import { type McpTool, type BaseMcpToolOutput, McpToolInput, validateAndResolvePath, PathValidationError, type McpToolExecuteOptions } from '@sylphlab/mcp-core';
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

// --- Tool Definition ---
export const deleteItemsTool: McpTool<typeof deleteItemsToolInputSchema, DeleteItemsToolOutput> = {
  name: 'deleteItemsTool',
  description: 'Deletes specified files or directories (supports globs - TODO: implement glob support). Uses trash by default.',
  inputSchema: deleteItemsToolInputSchema,

  async execute(input: DeleteItemsToolInput, options: McpToolExecuteOptions): Promise<DeleteItemsToolOutput> { // Remove workspaceRoot, require options
    // Zod validation
    const parsed = deleteItemsToolInputSchema.safeParse(input);
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

      // --- Validate and Resolve Path ---
      const validationResult = validateAndResolvePath(itemPath, options.workspaceRoot, options?.allowOutsideWorkspace); // Use options.workspaceRoot
      if (typeof validationResult !== 'string') {
          error = validationResult.error;
          suggestion = validationResult.suggestion;
          console.error(`Skipping delete for '${itemPath}': ${error}`);
          overallSuccess = false;
          results.push({ path: itemPath, success: false, error, suggestion });
          continue; // Skip to next itemPath
      }
      const fullPath = validationResult;
      // --- End Path Validation ---

      try {
          if (useTrash) {
            await trash(fullPath);
          } else {
            // force: true ignores errors if path doesn't exist, which is desired here
            await rm(fullPath, { recursive: recursive, force: true });
          }
          itemSuccess = true;
          message = `Item '${itemPath}' deleted (${deleteMethod}) successfully.`;
          console.error(message); // Log success to stderr
      } catch (e: any) {
          itemSuccess = false;
          overallSuccess = false;
          error = `Failed to ${deleteMethod} '${itemPath}': ${e.message}`;
          console.error(error);
          suggestion = `Check permissions for '${itemPath}' and its parent directories. Ensure the file/folder exists if using 'rm' without 'force: true'.`;
      }

      results.push({
        path: itemPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify({
        summary: `Delete operation completed. Overall success: ${overallSuccess}`,
        results: results
    }, null, 2); // Pretty-print JSON

    return {
      success: overallSuccess, // Keep original success logic
      results: results, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};