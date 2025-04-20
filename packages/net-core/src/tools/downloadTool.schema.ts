import { z } from 'zod';

// Schema for a single download item
export const DownloadItemSchema = z.object({
  id: z.string().optional(),
  url: z.string().url('Invalid URL format.'),
  destinationPath: z.string().min(1, 'Destination path cannot be empty.'),
  overwrite: z.boolean().default(false),
});

// Main input schema: an array of download items
export const downloadToolInputSchema = z.object({
  items: z.array(DownloadItemSchema).min(1, 'At least one download item is required.'),
});