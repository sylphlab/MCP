import { rename, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput } from '@sylphlab/mcp-core'; // Import base types

// --- Zod Schema for Input Validation ---
const MoveRenameItemSchema = z.object({
  sourcePath: z.string({ required_error: 'sourcePath is required' }).min(1, 'sourcePath cannot be empty'),
  destinationPath: z.string({ required_error: 'destinationPath is required' }).min(1, 'destinationPath cannot be empty'),
});

export const MoveRenameItemsToolInputSchema = z.object({
  items: z.array(MoveRenameItemSchema).min(1, 'items array cannot be empty'),
  overwrite: z.boolean().optional().default(false),
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

  async execute(input: MoveRenameItemsToolInput, workspaceRoot: string): Promise<MoveRenameItemsToolOutput> {
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
    const { items, overwrite } = parsed.data;
    // --- End Zod Validation ---

    const results: MoveRenameItemResult[] = [];
    let overallSuccess = true;

    for (const item of items) {
      const sourceFullPath = path.resolve(workspaceRoot, item.sourcePath);
      const destinationFullPath = path.resolve(workspaceRoot, item.destinationPath);
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;

      // --- Security Check ---
      const relativeSource = path.relative(workspaceRoot, sourceFullPath);
      const relativeDest = path.relative(workspaceRoot, destinationFullPath);
      if (relativeSource.startsWith('..') || path.isAbsolute(relativeSource) ||
          relativeDest.startsWith('..') || path.isAbsolute(relativeDest))
      {
          error = `Path validation failed: Paths must resolve within the workspace root ('${workspaceRoot}').`;
          console.error(`Skipping move ${item.sourcePath} -> ${item.destinationPath}: ${error}`);
          overallSuccess = false;
      } else if (sourceFullPath === destinationFullPath) {
          error = `Source and destination paths cannot be the same: '${item.sourcePath}'`;
          console.error(error);
          overallSuccess = false;
      } else {
        try {
          // Ensure destination directory exists
          const destDir = path.dirname(destinationFullPath);
          await mkdir(destDir, { recursive: true });

          // Handle overwrite logic
          let destinationExists = false;
          try {
              await stat(destinationFullPath); // Check if destination exists
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
                  await rm(destinationFullPath, { recursive: true, force: true }); // Remove existing destination
              } else {
                  throw new Error(`Destination path '${item.destinationPath}' already exists and overwrite is false.`);
              }
          }

          // Perform the rename/move operation
          await rename(sourceFullPath, destinationFullPath);

          itemSuccess = true;
          message = `Moved/Renamed '${item.sourcePath}' to '${item.destinationPath}' successfully.`;
          console.error(message); // Log success to stderr

        } catch (e: any) {
          itemSuccess = false;
          overallSuccess = false;
          error = `Failed to move/rename '${item.sourcePath}' to '${item.destinationPath}': ${e.message}`;
          console.error(error);
        }
      }

      results.push({
        sourcePath: item.sourcePath,
        destinationPath: item.destinationPath,
        success: itemSuccess,
        message,
        error,
      });
    }

    return {
      success: overallSuccess,
      results,
      // Add a default success message to content if overall successful
      content: overallSuccess
        ? [{ type: 'text', text: `Move/Rename operation completed. Success: ${overallSuccess}` }]
        : [],
    };
  },
};