import { z } from 'zod';

// Schema for a single PDF text extraction item
export const GetTextItemSchema = z.object({
  id: z.string().optional(),
  filePath: z.string().min(1, 'filePath cannot be empty.'),
  // Page selection options
  pages: z
    .union([
      z.array(z.number().int().positive()).optional(),
      z
        .object({
          start: z.number().int().positive(),
          end: z.number().int().positive(),
        })
        .optional(),
    ])
    .optional(),
});

// Main input schema: an array of PDF items
export const getTextToolInputSchema = z.object({
  items: z.array(GetTextItemSchema).min(1, 'At least one PDF item is required.'),
  includeMetadata: z.boolean().optional(),
  includePageCount: z.boolean().optional(),
  // allowOutsideWorkspace is handled by ToolExecuteOptions
});
