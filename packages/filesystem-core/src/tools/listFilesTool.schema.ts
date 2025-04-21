import { z } from 'zod';

// Main input schema: an array of paths to list
export const listFilesToolInputSchema = z.object({
  paths: z.array(z.string().min(1, 'Path cannot be empty.')).min(1, 'paths array cannot be empty.'),
  recursive: z.boolean().optional().default(false),
  maxDepth: z.number().int().min(0).optional(), // Optional depth limit
  includeStats: z.boolean().optional().default(false),
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});