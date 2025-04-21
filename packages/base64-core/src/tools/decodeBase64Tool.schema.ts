import { z } from 'zod';

// Input schema
export const DecodeBase64ToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
  encoded: z.string({ required_error: 'Encoded data must be a string.' }),
});
