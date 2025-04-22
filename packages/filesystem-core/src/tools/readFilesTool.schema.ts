import { z } from 'zod';

// Main input schema: an array of paths to read
export const readFilesToolInputSchema = z.object({
  paths: z.array(z.string().min(1, 'Path cannot be empty.')).min(1, 'paths array cannot be empty.'),
  encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8'),
  includeStats: z.boolean().optional().default(false),
  includeLineNumbers: z.boolean().optional().default(false), // Added
  includeHash: z.boolean().optional().default(true), // Added, default true
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});
