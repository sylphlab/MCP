import { z } from 'zod';
import { NodeSchema } from '../types.js'; // Import the Node schema

// Input schema: Optional entity type filter, limit, and offset
export const listNodesToolInputSchema = z.object({
  entity_type: z.string().min(1).optional(), // Optional label to filter by
  limit: z.number().int().positive().optional().default(50), // Default limit 50
  offset: z.number().int().nonnegative().optional().default(0), // Default offset 0
});

// Output schema: An object containing the list of nodes and the total count matching the filter
export const listNodesToolOutputSchema = z.object({
  nodes: z.array(NodeSchema),
  totalCount: z.number().int().nonnegative(),
});