import { z } from 'zod';

// Schema for a single relation input (same as createRelations)
const RelationInputSchema = z.object({
  from: z.string().min(1, { message: "Source entity name ('from') cannot be empty." }),
  to: z.string().min(1, { message: "Target entity name ('to') cannot be empty." }),
  relationType: z.string().min(1, { message: "Relation type cannot be empty." }),
});

// Schema for the tool's input (an array of relations to delete)
export const deleteRelationsToolInputSchema = z.object({
  relations: z.array(RelationInputSchema).min(1, { message: "Must provide at least one relation to delete." }),
});

// Schema for the tool's output (a single number representing the count of deleted relations)
export const deleteRelationsToolOutputSchema = z.number().int().nonnegative();