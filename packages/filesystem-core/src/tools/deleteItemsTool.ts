import { rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import trash from 'trash'; // Import the trash library
import { McpTool, BaseMcpToolOutput, McpToolInput } from '@sylphlab/mcp-core'; // Import base types

// --- Zod Schema for Input Validation ---
export const DeleteItemsToolInputSchema = z.object({
  paths: z.array(
      z.string({ required_error: 'Each path must be a string' })
       .min(1, 'Path cannot be empty')
    )
    .min(1, 'paths array cannot be empty'),
  recursive: z.boolean().optional().default(true), // Default recursive to true
  useTrash: z.boolean().optional().default(true), // Default useTrash to true
});

// Infer the TypeScript type from the Zod schema
export type DeleteItemsToolInput = z.infer<typeof DeleteItemsToolInputSchema>;

// --- Output Types ---
export interface DeleteItemResult {
  /** The path provided in the input. */
  path: string;
  /** Whether the deletion operation for this specific path was successful. */
  success: boolean;
  /** Optional message providing more details. */
  message?: string;
  /** Optional error message if the operation failed for this path. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Extend the base output type
export interface DeleteItemsToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true only if ALL items deleted successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each deletion operation. */
  results: DeleteItemResult[];
}

// --- Tool Definition (following SDK pattern) ---

export const deleteItemsTool: McpTool<typeof DeleteItemsToolInputSchema, DeleteItemsToolOutput> = {
  name: 'deleteItemsTool',
  description: 'Deletes specified files or directories (supports globs - TODO: implement glob support). Uses trash by default.',
  inputSchema: DeleteItemsToolInputSchema,

  async execute(input: DeleteItemsToolInput, workspaceRoot: string): Promise<DeleteItemsToolOutput> {
    // Zod validation
    const parsed = DeleteItemsToolInputSchema.safeParse(input);
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
    const { paths: inputPaths, recursive, useTrash } = parsed.data;
    // --- End Zod Validation ---

    // TODO: Implement glob expansion for inputPaths if needed
    const resolvedPaths = inputPaths; // Placeholder for now

    const results: DeleteItemResult[] = [];
    let overallSuccess = true;

    for (const itemPath of resolvedPaths) {
      const fullPath = path.resolve(workspaceRoot, itemPath);
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      const deleteMethod = useTrash ? 'trash' : 'delete permanently';

      // --- Security Check ---
      const relativePath = path.relative(workspaceRoot, fullPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        error = `Path validation failed: Path must resolve within the workspace root ('${workspaceRoot}'). Relative Path: '${relativePath}'`;
        console.error(error);
        message = `Suggestion: Ensure the path '${itemPath}' is relative to the workspace root and does not attempt to go outside it.`; // Use message for suggestion
        overallSuccess = false;
      } else {
        try {
          if (useTrash) {
            await trash(fullPath); // Use trash library
          } else {
            // Use fs.rm for permanent deletion
            // force: true ignores errors if path doesn't exist
            await rm(fullPath, { recursive: recursive, force: true });
          }
          itemSuccess = true;
          message = `Item '${itemPath}' deleted (${deleteMethod}) successfully.`;
          console.error(message); // Log success to stderr
        } catch (e: any) {
          itemSuccess = false;
          overallSuccess = false;
          // Handle potential errors (e.g., permissions, file not found if force: false)
          error = `Failed to ${deleteMethod} '${itemPath}': ${e.message}`;
          console.error(error);
          message = `Suggestion: Check permissions for '${itemPath}' and its parent directories. Ensure the file/folder exists if using 'rm' without 'force: true'.`; // Use message for suggestion
        }
      }

      results.push({
        path: itemPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? message : undefined,
      });
    }

    return {
      success: overallSuccess, // True only if all operations succeeded
      results,
      // Add a default success message to content if overall successful
      content: overallSuccess
        ? [{ type: 'text', text: `Delete operation completed. Success: ${overallSuccess}` }]
        : [],
    };
  },
};