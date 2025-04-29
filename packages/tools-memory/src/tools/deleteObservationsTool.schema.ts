import { z } from 'zod';

// Schema for a single deletion input object
const DeletionInputSchema = z.object({
  entityName: z.string().min(1, { message: "Entity name cannot be empty." }),
  observations: z.array(z.string().min(1, { message: "Observation content to delete cannot be empty." }))
                 .min(1, { message: "Must provide at least one observation content string to delete." }),
});

// Schema for the tool's input (an array of deletion objects)
export const deleteObservationsToolInputSchema = z.object({
  deletions: z.array(DeletionInputSchema).min(1, { message: "Must provide at least one deletion object." }),
});

// Schema for a single deletion output object
export const DeletionOutputSchema = z.object({
    entityName: z.string(),
    deletedCount: z.number().int().nonnegative(), // Reports the number of observations actually deleted
});

// Schema for the tool's output (an array of deletion output objects)
export const deleteObservationsToolOutputSchema = z.array(DeletionOutputSchema);