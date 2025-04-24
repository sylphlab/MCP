import { z } from 'zod';

// Schema for a single PDF text extraction item
export const GetTextItemSchema = z.object({
  id: z.string().optional(),
  filePath: z.string().min(1, 'filePath cannot be empty.'),
  // Add options like page range later if needed
});

// Main input schema: an array of PDF items
export const getTextToolInputSchema = z.object({
  items: z.array(GetTextItemSchema).min(1, 'At least one PDF item is required.'),
  // allowOutsideWorkspace is handled by ToolExecuteOptions
});
