import { cp } from 'node:fs/promises'; // Use named import
import path from 'node:path';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, validateAndResolvePath, PathValidationError, McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import base types and validation util
import { copyItemsToolInputSchema, CopyItemSchema } from './copyItemsTool.schema.js'; // Import schema (added .js)

// --- Input Types ---

// Infer the TypeScript type from the Zod schema
export type CopyItemsToolInput = z.infer<typeof copyItemsToolInputSchema>;
// Infer the single item type as well
type CopyItem = z.infer<typeof CopyItemSchema>;


// --- Output Types ---

export interface CopyItemResult {
  /** The source path provided in the input. */
  sourcePath: string;
  /** The destination path provided in the input. */
  destinationPath: string;
  /** Whether the copy operation for this specific item was successful. */
  success: boolean;
  /** Optional message providing more details (e.g., "Copied successfully"). */
  message?: string;
  /** Optional error message if the operation failed for this item. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Extend the base output type
export interface CopyItemsToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true only if ALL items copied successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each copy operation. */
  results: CopyItemResult[];
}

// --- Tool Definition ---

export const copyItemsTool: McpTool<typeof copyItemsToolInputSchema, CopyItemsToolOutput> = {
  name: 'copyItemsTool',
  description: 'Copies one or more files or folders within the workspace. Handles recursion. Use relative paths.',
  inputSchema: copyItemsToolInputSchema,
  async execute(input: CopyItemsToolInput, options: McpToolExecuteOptions): Promise<CopyItemsToolOutput> { // Remove workspaceRoot, require options
    // Zod validation
    const parsed = copyItemsToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      return {
        success: false,
        error: `Input validation failed: ${errorMessages}`,
        results: [],
        content: [], // Add required content field
      };
    }
    const { items, overwrite } = parsed.data; // allowOutsideWorkspace comes from options

    const results: CopyItemResult[] = [];
    let overallSuccess = true;

    for (const item of items) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;

      // --- Validate and Resolve Paths ---
      const sourceValidationResult = validateAndResolvePath(item.sourcePath, options.workspaceRoot, options?.allowOutsideWorkspace); // Use options.workspaceRoot
      if (typeof sourceValidationResult !== 'string') {
          error = sourceValidationResult.error;
          suggestion = sourceValidationResult.suggestion;
          console.error(`Skipping copy for source '${item.sourcePath}': ${error}`);
          overallSuccess = false;
          results.push({ sourcePath: item.sourcePath, destinationPath: item.destinationPath, success: false, error, suggestion });
          continue;
      }
      const sourceFullPath = sourceValidationResult;

      const destValidationResult = validateAndResolvePath(item.destinationPath, options.workspaceRoot, options?.allowOutsideWorkspace); // Use options.workspaceRoot
       if (typeof destValidationResult !== 'string') {
          error = destValidationResult.error;
          suggestion = destValidationResult.suggestion;
          console.error(`Skipping copy for destination '${item.destinationPath}': ${error}`);
          overallSuccess = false;
          results.push({ sourcePath: item.sourcePath, destinationPath: item.destinationPath, success: false, error, suggestion });
          continue;
      }
      const destinationFullPath = destValidationResult;
      // --- End Path Validation ---


      try {
        await cp(sourceFullPath, destinationFullPath, {
          recursive: true,
          force: overwrite,
          errorOnExist: !overwrite,
        });
        itemSuccess = true;
        message = `Copied '${item.sourcePath}' to '${item.destinationPath}' successfully.`;
        console.error(message); // Log success to stderr
      } catch (e: any) {
        itemSuccess = false;
        if (e.code === 'ENOENT') {
            error = `Failed to copy '${item.sourcePath}': Source path does not exist.`;
            suggestion = `Verify the source path '${item.sourcePath}' exists and is accessible.`;
        } else if (e.code === 'EEXIST' && !overwrite) {
            error = `Failed to copy to '${item.destinationPath}': Destination path already exists and overwrite is false.`;
            suggestion = `Enable the 'overwrite' option or choose a different destination path.`;
        } else {
            error = `Failed to copy '${item.sourcePath}' to '${item.destinationPath}': ${e.message}`;
            suggestion = `Check file paths, permissions, and available disk space.`;
        }
        console.error(error);
        overallSuccess = false;
      }

      results.push({
        sourcePath: item.sourcePath,
        destinationPath: item.destinationPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined, // Use suggestion calculated in catch block
      });
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify({
        summary: `Copy operation completed. Overall success: ${overallSuccess}`,
        results: results
    }, null, 2); // Pretty-print JSON

    return {
      success: overallSuccess,
      results: results, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};