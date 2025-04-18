import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput } from '@sylphlab/mcp-core'; // Import base types

// --- Zod Schema for Input Validation ---
export const CreateFolderToolInputSchema = z.object({
  folderPaths: z.array(
      z.string({ required_error: 'Each path must be a string' })
       .min(1, 'Folder path cannot be empty')
    )
    .min(1, 'folderPaths array cannot be empty'),
});

// Infer the TypeScript type from the Zod schema
export type CreateFolderToolInput = z.infer<typeof CreateFolderToolInputSchema>;

// --- Output Types ---
export interface CreateFolderResult {
  /** The folder path provided in the input. */
  path: string;
  /** Whether the creation operation for this specific path was successful. */
  success: boolean;
  /** Optional message providing more details. */
  message?: string;
  /** Optional error message if the operation failed for this path. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Extend the base output type
export interface CreateFolderToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true if at least one folder was created successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each folder creation operation. */
  results: CreateFolderResult[];
}

// --- Tool Definition (following SDK pattern) ---

export const createFolderTool: McpTool<typeof CreateFolderToolInputSchema, CreateFolderToolOutput> = {
  name: 'createFolderTool',
  description: 'Creates one or more new folders at the specified paths within the workspace.',
  inputSchema: CreateFolderToolInputSchema,

  async execute(input: CreateFolderToolInput, workspaceRoot: string): Promise<CreateFolderToolOutput> {
    // Zod validation
    const parsed = CreateFolderToolInputSchema.safeParse(input);
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
    // Use validated data from now on
    const { folderPaths } = parsed.data;
    // --- End Zod Validation ---

    const results: CreateFolderResult[] = [];
    let anySuccess = false; // Track if at least one succeeds

    for (const folderPath of folderPaths) { // Use folderPaths from parsed.data
      const fullPath = path.resolve(workspaceRoot, folderPath);
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;

      // --- Security Check ---
      const relativePath = path.relative(workspaceRoot, fullPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        error = `Path validation failed: Path must resolve within the workspace root ('${workspaceRoot}'). Relative Path: '${relativePath}'`;
        console.error(error);
        message = `Suggestion: Ensure the path '${folderPath}' is relative to the workspace root and does not attempt to go outside it.`; // Use message for suggestion
      } else {
        try {
          // Perform the mkdir operation
          await mkdir(fullPath, { recursive: true }); // recursive: true prevents errors if path exists, creates parents
          itemSuccess = true;
          anySuccess = true; // Mark overall success if at least one works
          message = `Folder created successfully at '${folderPath}'.`;
          console.error(message); // Log success to stderr
        } catch (e: any) {
          // mkdir with recursive: true usually only fails on permissions or invalid path chars
          error = `Failed to create folder '${folderPath}': ${e.message}`;
          console.error(error);
          message = `Suggestion: Check permissions for the directory containing '${folderPath}' and ensure the path name is valid.`; // Use message for suggestion
        }
      }

      results.push({
        path: folderPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? message : undefined,
      });
    }

    return {
      success: anySuccess, // True if at least one succeeded
      results,
      // Add a default success message to content if overall successful
      content: anySuccess
        ? [{ type: 'text', text: `Create folder operation completed. Success: ${anySuccess}` }]
        : [],
    };
  },
};