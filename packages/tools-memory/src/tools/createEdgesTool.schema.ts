import { z } from 'zod';
import { EdgeSchema, PropertiesSchema } from '../types.js'; // Import Edge and Properties schemas

// Schema for a single edge input
const EdgeInputSchema = z.object({
  type: z.string().min(1, { message: "Edge type cannot be empty." }),
  from: z.string().uuid({ message: "Edge 'from' must be a valid Node UUID." }),
  to: z.string().uuid({ message: "Edge 'to' must be a valid Node UUID." }),
  properties: PropertiesSchema.optional(), // Properties are optional
});

// Schema for the tool's input (an array of edges)
export const createEdgesToolInputSchema = z.object({
  edges: z.array(EdgeInputSchema).min(1, { message: "Must provide at least one edge to create." }),
});

// Schema for the tool's output (an array of successfully created edges)
// Note: If edges don't have IDs, the output might be the same as input, or just a success indicator.
// Let's output the created Edge objects for now, assuming they might get IDs or for confirmation.
export const createEdgesToolOutputSchema = z.array(EdgeSchema);