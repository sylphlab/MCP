import { rename, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, validateAndResolvePath, PathValidationError, McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import base types and validation util

// --- Zod Schema for Input Validation ---
const MoveRenameItemSchema = z.object({
  sourcePath: z.string({ required_error: 'sourcePath is required' }).min(1, 'sourcePath cannot be empty'),
  destinationPath: z.string({ required_error: 'destinationPath is required' }).min(1, 'destinationPath cannot be empty'),
});

export const MoveRenameItemsToolInputSchema = z.object({
  items: z.array(MoveRenameItemSchema).min(1, 'items array cannot be empty'),
  overwrite: z.boolean().optional().default(false),
  // allowOutsideWorkspace removed from schema
});

// Infer the TypeScript type from the Zod schema
export type MoveRenameItemsToolInput = z.infer<typeof MoveRenameItemsToolInputSchema>;

// --- Output Types ---
export interface MoveRenameItemResult {
  /** The source path provided in the input. */
  sourcePath: string;
  /** The destination path provided in the input. */
  destinationPath: string;
  /** Whether the move/rename operation for this specific item was successful. */
  success: boolean;
  /** Optional message providing more details. */
  message?: string;
  /** Optional error message if the operation failed for this item. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
  // Removed duplicate suggestion property
}

// Extend the base output type
export interface MoveRenameItemsToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true only if ALL items moved/renamed successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each move/rename operation. */
  results: MoveRenameItemResult[];
}

// --- Tool Definition (following SDK pattern) ---

export const moveRenameItemsTool: McpTool<typeof MoveRenameItemsToolInputSchema, MoveRenameItemsToolOutput> = {
  name: 'moveRenameItemsTool',
  description: 'Moves or renames one or more files or folders within the workspace. Use relative paths.',
  inputSchema: MoveRenameItemsToolInputSchema,

  async execute(input: MoveRenameItemsToolInput, options: McpToolExecuteOptions): Promise<MoveRenameItemsToolOutput> { // Remove workspaceRoot, require options
    // Zod validation
    const parsed = MoveRenameItemsToolInputSchema.safeParse(input);
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
    // --- End Zod Validation ---

    const results: MoveRenameItemResult[] = [];
    let overallSuccess = true;

    for (const item of items) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined; // Declare suggestion
      let sourceFullPath: string | undefined; // Use let for validated paths
      let destinationFullPath: string | undefined; // Use let for validated paths

      // --- Validate Paths ---
      const sourceValidation = validateAndResolvePath(item.sourcePath, options.workspaceRoot, options?.allowOutsideWorkspace); // Use options.workspaceRoot
      if (typeof sourceValidation !== 'string') {
          error = `Source path validation failed: ${sourceValidation.error}`;
          suggestion = sourceValidation.suggestion;
          overallSuccess = false;
      } else {
          sourceFullPath = sourceValidation;
      }

      if (!error) { // Only validate destination if source is valid
          const destValidation = validateAndResolvePath(item.destinationPath, options.workspaceRoot, options?.allowOutsideWorkspace); // Use options.workspaceRoot
          if (typeof destValidation !== 'string') {
              error = `Destination path validation failed: ${destValidation.error}`;
              suggestion = destValidation.suggestion;
              overallSuccess = false;
          } else {
              destinationFullPath = destValidation;
          }
      }
      // --- End Path Validation ---

      // Check if paths are the same after validation
      if (!error && sourceFullPath === destinationFullPath) {
          error = `Source and destination paths resolve to the same location: '${sourceFullPath}'`;
          suggestion = `Provide different source and destination paths.`;
          overallSuccess = false;
      }

      // Proceed only if paths are valid and different
      if (!error && sourceFullPath && destinationFullPath) {
        try {
          // Ensure destination directory exists
          const destDir = path.dirname(destinationFullPath); // Use validated path
          await mkdir(destDir, { recursive: true });

          // Handle overwrite logic
          let destinationExists = false;
          try {
              await stat(destinationFullPath); // Check if destination exists (use validated path)
              destinationExists = true;
          } catch (statError: any) {
              if (statError.code !== 'ENOENT') {
                  throw statError; // Re-throw unexpected errors
              }
              // ENOENT means destination doesn't exist, which is fine
          }

          if (destinationExists) {
              if (overwrite) {
                  console.error(`Overwrite enabled: Removing existing destination '${item.destinationPath}' before move.`); // Log to stderr
                  await rm(destinationFullPath, { recursive: true, force: true }); // Remove existing destination (use validated path)
              } else {
                  throw new Error(`Destination path '${item.destinationPath}' already exists and overwrite is false.`);
              }
          }

          // Perform the rename/move operation (use validated paths)
          await rename(sourceFullPath, destinationFullPath);

          itemSuccess = true;
          message = `Moved/Renamed '${item.sourcePath}' to '${item.destinationPath}' successfully.`;
          console.error(message); // Log success to stderr

        } catch (e: any) {
          itemSuccess = false;
          overallSuccess = false;
          error = `Failed to move/rename '${item.sourcePath}' to '${item.destinationPath}': ${e.message}`;
          console.error(error);
          // Add suggestion based on error type if possible
          if (e.code === 'ENOENT') {
              suggestion = `Suggestion: Verify the source path '${item.sourcePath}' exists.`; // Assign to suggestion
          } else if (e.message.includes('already exists and overwrite is false')) {
              suggestion = `Suggestion: Enable the 'overwrite' option or choose a different destination path.`; // Assign to suggestion
          } else if (e.code === 'EPERM' || e.code === 'EACCES') {
              suggestion = `Suggestion: Check file system permissions for both source and destination paths.`; // Assign to suggestion
          } else {
              suggestion = `Suggestion: Check file paths, permissions, and disk space.`; // Assign to suggestion
          }
        }
      }

      results.push({
        sourcePath: item.sourcePath,
        destinationPath: item.destinationPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        // Use the suggestion populated during validation or catch block if item failed
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify({
        summary: `Move/Rename operation completed. Overall success: ${overallSuccess}`,
        results: results
    }, null, 2); // Pretty-print JSON

    return {
      success: overallSuccess,
      results: results, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};