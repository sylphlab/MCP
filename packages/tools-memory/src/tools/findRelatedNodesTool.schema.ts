import { z } from 'zod';
import { NodeSchema } from '../types.js'; // Import the Node schema

// Define allowed traversal directions
const DirectionEnum = z.enum(['incoming', 'outgoing', 'both']).default('both');

// Input schema
export const findRelatedNodesToolInputSchema = z.object({
  start_node_id: z.string().uuid({ message: "Start node ID must be a valid UUID." }),
  direction: DirectionEnum.optional(), // 'incoming', 'outgoing', or 'both' (default)
  relation_type: z.string().min(1).optional(), // Optional relation type to filter by
  // Optional filters for relation properties (more complex, maybe add later)
  // relation_properties_filter: z.record(z.any()).optional(),
  // Optional filters for the target/end node
  end_node_label: z.string().min(1).optional(), // Filter related nodes by label
  // end_node_properties_filter: z.record(z.any()).optional(), // Filter related nodes by properties (more complex)
  limit: z.number().int().positive().optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

// Output schema: Similar to listNodes, includes related nodes and total count
export const findRelatedNodesToolOutputSchema = z.object({
  nodes: z.array(NodeSchema),
  totalCount: z.number().int().nonnegative(),
});