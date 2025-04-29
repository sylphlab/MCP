import { z } from 'zod';
// Reuse the output schema from readGraphTool as search also returns a graph structure
import { readGraphToolOutputSchema } from './readGraphTool.schema.js';

// Input schema requires a query string
export const searchNodesToolInputSchema = z.object({
  query: z.string().min(1, { message: "Search query cannot be empty." }),
});

// Output schema is the same as readGraph (a KnowledgeGraph structure)
export const searchNodesToolOutputSchema = readGraphToolOutputSchema;