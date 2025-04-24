import { z } from 'zod';

// Main input schema: an array of paths to delete
export const deleteItemsToolInputSchema = z.object({
  paths: z.array(z.string().min(1, 'Path cannot be empty.')).min(1, 'paths array cannot be empty.'),
  recursive: z.boolean().optional().default(true), // Default to recursive for safety with rm
  useTrash: z.boolean().optional().default(true), // Default to using trash
  dryRun: z.boolean().optional(), // Added: Optional dry run flag
  // allowOutsideWorkspace is handled by ToolExecuteOptions
});
