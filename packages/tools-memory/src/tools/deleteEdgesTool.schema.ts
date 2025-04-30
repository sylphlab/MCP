import { z } from 'zod';

// Schema for identifying a single edge to delete (using type, from, to)
const EdgeIdentifierSchema = z.object({
  type: z.string().min(1, { message: "Edge type cannot be empty." }),
  from: z.string().uuid({ message: "Edge 'from' must be a valid Node UUID." }),
  to: z.string().uuid({ message: "Edge 'to' must be a valid Node UUID." }),
});

// Schema for the tool's input (an array of edge identifiers)
export const deleteEdgesToolInputSchema = z.object({
  edges: z.array(EdgeIdentifierSchema).min(1, { message: "Must provide at least one edge identifier to delete." }),
});

// Schema for the tool's output (a single number representing the count of deleted edges)
export const deleteEdgesToolOutputSchema = z.number().int().nonnegative();