import { z } from 'zod';

// Input schema
export const EncodeBase64ToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
  input: z.string({ required_error: 'Input data must be a string.' }),
});
