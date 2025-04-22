import { z } from 'zod';

// Schema for a single replacement operation
export const ReplaceOperationSchema = z.object({
  search: z.string().min(1, 'Search pattern cannot be empty.'),
  replace: z.string(),
  isRegex: z.boolean().optional().default(false),
  flags: z.string().optional(), // Regex flags (e.g., 'g', 'i')
});

// Main input schema: paths and operations
export const replaceContentToolInputSchema = z.object({
  paths: z
    .array(z.string().min(1, 'Path/glob pattern cannot be empty.'))
    .min(1, 'paths array cannot be empty.'),
  operations: z.array(ReplaceOperationSchema).min(1, 'operations array cannot be empty.'),
  dryRun: z.boolean().optional(), // Added: Optional dry run flag
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});
