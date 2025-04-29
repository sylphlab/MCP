import { z } from 'zod';

// Schema for a single relation input
const RelationInputSchema = z.object({
  from: z.string().min(1, { message: "Source entity name ('from') cannot be empty." }),
  to: z.string().min(1, { message: "Target entity name ('to') cannot be empty." }),
  relationType: z.string().min(1, { message: "Relation type cannot be empty." }),
});

// Schema for the tool's input (an array of relations)
export const createRelationsToolInputSchema = z.object({
  relations: z.array(RelationInputSchema).min(1, { message: "Must provide at least one relation to create." }),
});

// Schema for a single relation output (matches the Relation interface)
export const RelationOutputSchema = z.object({
    from: z.string(),
    to: z.string(),
    relationType: z.string(),
});

// Schema for the tool's output (an array of successfully created relations)
export const createRelationsToolOutputSchema = z.array(RelationOutputSchema);