import { z } from 'zod';

// Schema for a single file write item
export const WriteFileItemSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty.'),
  expectedHash: z.string().optional(), // Added: Optional expected SHA-256 hash (relevant for overwrite)
  content: z.string(), // Content is always a string
});

// Main input schema: an array of write items and options
export const writeFilesToolInputSchema = z.object({
  items: z.array(WriteFileItemSchema).min(1, 'At least one file item is required.'),
  encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8'),
  append: z.boolean().optional().default(false),
  dryRun: z.boolean().optional(), // Added: Optional dry run flag
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});
