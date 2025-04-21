import { z } from 'zod';

// Schema for a single copy operation item
export const CopyItemSchema = z.object({
  sourcePath: z.string().min(1, 'Source path cannot be empty.'),
  destinationPath: z.string().min(1, 'Destination path cannot be empty.'),
});

// Main input schema: an array of copy items
export const copyItemsToolInputSchema = z.object({
  items: z.array(CopyItemSchema).min(1, 'At least one copy item is required.'),
  overwrite: z.boolean().default(false),
  // allowOutsideWorkspace is handled by McpToolExecuteOptions, not part of tool input schema
});