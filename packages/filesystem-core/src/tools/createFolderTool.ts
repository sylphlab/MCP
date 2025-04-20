import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, validateAndResolvePath, PathValidationError, McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type

// --- Zod Schema for Input Validation ---
export const CreateFolderToolInputSchema = z.object({
  folderPaths: z.array(
      z.string({ required_error: 'Each path must be a string' })
       .min(1, 'Folder path cannot be empty')
    )
    .min(1, 'folderPaths array cannot be empty'),
 // allowOutsideWorkspace removed from schema
});

// Infer the TypeScript type from the Zod schema
export type CreateFolderToolInput = z.infer<typeof CreateFolderToolInputSchema>;

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

// --- Tool Definition ---
export const createFolderTool: McpTool<typeof CreateFolderToolInputSchema, CreateFolderToolOutput> = {
  name: 'createFolderTool',
  description: 'Creates one or more new folders at the specified paths within the workspace.',
  inputSchema: CreateFolderToolInputSchema,

  async execute(input: CreateFolderToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<CreateFolderToolOutput> { // Add options
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
        content: [],
      };
    }
    const { folderPaths } = parsed.data; // allowOutsideWorkspace comes from options

    const results: CreateFolderResult[] = [];
    let anySuccess = false;

    for (const folderPath of folderPaths) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;

      // --- Validate and Resolve Path ---
      const validationResult = validateAndResolvePath(folderPath, workspaceRoot, options?.allowOutsideWorkspace); // Pass flag from options
      if (typeof validationResult !== 'string') {
          error = validationResult.error;
          suggestion = validationResult.suggestion;
          console.error(`Skipping create folder for '${folderPath}': ${error}`);
          // Don't set overallSuccess to false here, as one path failure shouldn't stop others
          results.push({ path: folderPath, success: false, error, suggestion });
          continue; // Skip to next folderPath
      }
      const fullPath = validationResult;
      // --- End Path Validation ---

      try {
          // Perform the mkdir operation
          await mkdir(fullPath, { recursive: true });
          itemSuccess = true;
          anySuccess = true;
          message = `Folder created successfully at '${folderPath}'.`;
          console.error(message); // Log success to stderr
      } catch (e: any) {
          itemSuccess = false;
          error = `Failed to create folder '${folderPath}': ${e.message}`;
          console.error(error);
          suggestion = `Check permissions for the directory containing '${folderPath}' and ensure the path name is valid.`;
      }

      results.push({
        path: folderPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify({
        summary: `Create folder operation completed. Overall success (at least one): ${anySuccess}`,
        results: results
    }, null, 2); // Pretty-print JSON

    return {
      success: anySuccess, // Keep original success logic (true if any succeeded)
      results: results, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};