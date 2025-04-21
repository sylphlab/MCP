import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
  PathValidationError, // PathValidationError might not be needed directly
  validateAndResolvePath,
} from '@sylphlab/mcp-core'; // Import options type
import type { z } from 'zod';
import { createFolderToolInputSchema } from './createFolderTool.schema.js'; // Import schema (added .js)

// Infer the TypeScript type from the Zod schema
export type CreateFolderToolInput = z.infer<typeof createFolderToolInputSchema>;

// --- Output Types ---
export interface CreateFolderResult {
  path: string;
  success: boolean;
  message?: string;
  error?: string;
  suggestion?: string;
}

// Extend the base output type
export interface CreateFolderToolOutput extends BaseMcpToolOutput {
  error?: string;
  results: CreateFolderResult[];
}

// --- Tool Definition using defineTool ---
export const createFolderTool = defineTool({
  name: 'createFolderTool',
  description: 'Creates one or more new folders at the specified paths within the workspace.',
  inputSchema: createFolderToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: CreateFolderToolInput,
    options: McpToolExecuteOptions,
  ): Promise<CreateFolderToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = createFolderToolInputSchema.safeParse(input);
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
    const { folderPaths } = parsed.data;

    const results: CreateFolderResult[] = [];
    let anySuccess = false;

    for (const folderPath of folderPaths) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let fullPath: string;

      // --- Validate and Resolve Path ---
      const validationResult = validateAndResolvePath(
        folderPath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = validationResult.error;
        suggestion = validationResult.suggestion;
        results.push({ path: folderPath, success: false, error, suggestion });
        continue; // Skip to next folderPath
      }
      fullPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual folder creation errors
      try {
        await mkdir(fullPath, { recursive: true });
        itemSuccess = true;
        anySuccess = true; // Mark overall success if at least one folder is created
        message = `Folder created successfully at '${folderPath}'.`;
      } catch (e: unknown) {
        itemSuccess = false;
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        error = `Failed to create folder '${folderPath}': ${errorMsg}`;
        suggestion = `Check permissions for the directory containing '${folderPath}' and ensure the path name is valid.`;
        // Note: We don't set overallSuccess to false here, partial success is possible.
      }

      // Push result for this path
      results.push({
        path: folderPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End for loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Create folder operation completed. Overall success (at least one): ${anySuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: anySuccess, // Success is true if at least one folder was created
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { CreateFolderToolInput, CreateFolderToolOutput, CreateFolderResult }; // Removed duplicate export
