import { z } from 'zod';

// Schema for a single download item
export const DownloadItemSchema = z.object({
  id: z.string().optional(), // Optional ID for correlation
  url: z.string().url({ message: 'Invalid URL provided.' }),
  destinationPath: z
    .string()
    .min(1, { message: 'Destination path cannot be empty.' })
    .refine((val) => !val.startsWith('/') && !/^[a-zA-Z]:\\/.test(val), {
      message: 'Destination path must be relative.',
    }),
  overwrite: z.boolean().optional().default(false),
});

// Main input schema: an array of download items
export const downloadToolInputSchema = z.object({
  items: z.array(DownloadItemSchema).min(1, 'At least one download item is required.'),
});