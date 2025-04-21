import { z } from 'zod';

// Main input schema: paths, query, and options
export const searchContentToolInputSchema = z.object({
  paths: z
    .array(z.string().min(1, 'Path/glob pattern cannot be empty.'))
    .min(1, 'paths array cannot be empty.'),
  query: z.string().min(1, 'Query string cannot be empty.'),
  isRegex: z.boolean().optional().default(false),
  matchCase: z.boolean().optional().default(true),
  contextLinesBefore: z.number().int().min(0).optional().default(0),
  contextLinesAfter: z.number().int().min(0).optional().default(0),
  maxResultsPerFile: z.number().int().min(1).optional(),
  // lineRange: z.object({ start: z.number().int().min(1), end: z.number().int().min(1) }).optional(), // TODO: Add line range support
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});
