import { z } from 'zod';

// Main input schema: an array of paths to stat
export const statItemsToolInputSchema = z.object({
  paths: z.array(z.string().min(1, 'Path cannot be empty.')).min(1, 'paths array cannot be empty.'),
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});
