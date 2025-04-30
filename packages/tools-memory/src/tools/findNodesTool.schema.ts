import { z } from 'zod';
import { NodeSchema } from '../types.js'; // Import the Node schema

// Define allowed search fields
const SearchInEnum = z.enum(['name', 'labels', 'properties', 'all']).default('all');
// Define allowed search modes
const ModeEnum = z.enum(['substring', 'exact']).default('substring');

// Input schema
export const findNodesToolInputSchema = z.object({
  query: z.string().min(1, { message: "Search query cannot be empty." }),
  search_in: SearchInEnum.optional(), // Where to search: 'name', 'labels', 'properties', or 'all' (default)
  mode: ModeEnum.optional(), // How to search: 'substring' (default) or 'exact'
  limit: z.number().int().positive().optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

// Output schema: Similar to listNodes, includes nodes and total count
export const findNodesToolOutputSchema = z.object({
  nodes: z.array(NodeSchema),
  totalCount: z.number().int().nonnegative(),
});