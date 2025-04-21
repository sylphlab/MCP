import { z } from 'zod';

// Input schema - no parameters needed for this specific tool
export const GetPublicIpToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
});