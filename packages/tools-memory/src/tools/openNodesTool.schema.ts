import { z } from 'zod';
// Reuse the output schema from readGraphTool as open also returns a graph structure
import { readGraphToolOutputSchema } from './readGraphTool.schema.js';

// Input schema requires an array of entity names
export const openNodesToolInputSchema = z.object({
  names: z.array(z.string().min(1, { message: "Entity name cannot be empty." }))
          .min(1, { message: "Must provide at least one entity name to open." }),
});

// Output schema is the same as readGraph (a KnowledgeGraph structure)
export const openNodesToolOutputSchema = readGraphToolOutputSchema;