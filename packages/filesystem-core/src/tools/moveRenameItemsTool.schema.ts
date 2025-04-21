import { z } from 'zod';

// Schema for a single move/rename operation item
export const MoveRenameItemSchema = z.object({
  sourcePath: z.string().min(1, 'Source path cannot be empty.'),
  destinationPath: z.string().min(1, 'Destination path cannot be empty.'),
});

// Main input schema: an array of move/rename items
export const moveRenameItemsToolInputSchema = z.object({
  items: z.array(MoveRenameItemSchema).min(1, 'At least one move/rename item is required.'),
  overwrite: z.boolean().optional().default(false),
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});