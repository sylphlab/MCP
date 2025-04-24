import { z } from 'zod';

// Schema for a single wait item
export const WaitItemSchema = z.object({
  // Renamed and Exported
  id: z.string().optional(),
  durationMs: z.number().int().min(0, 'Duration must be non-negative.'),
});

// Main input schema: an array of wait items
export const waitToolInputSchema = z.object({
  items: z.array(WaitItemSchema).min(1, 'At least one wait item is required.'), // Use items array
});
