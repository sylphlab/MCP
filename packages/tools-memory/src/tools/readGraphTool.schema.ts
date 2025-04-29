import { z } from 'zod';
import { EntityOutputSchema } from './createEntitiesTool.schema.js'; // Import only EntityOutputSchema

// Define RelationOutputSchema here as it wasn't exported from createEntitiesTool.schema.ts
const RelationOutputSchema = z.object({
  from: z.string(),
  to: z.string(),
  relationType: z.string(),
});

// Input schema is empty as no arguments are needed
export const readGraphToolInputSchema = z.object({});

// Output schema represents the entire graph structure
export const readGraphToolOutputSchema = z.object({
  entities: z.array(EntityOutputSchema),
  relations: z.array(RelationOutputSchema),
});