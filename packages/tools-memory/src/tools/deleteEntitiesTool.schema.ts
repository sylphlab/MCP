import { z } from 'zod';

// Schema for the tool's input (an array of entity names)
export const deleteEntitiesToolInputSchema = z.object({
  entityNames: z.array(z.string().min(1, { message: "Entity name cannot be empty." }))
                .min(1, { message: "Must provide at least one entity name to delete." }),
});

// Schema for the tool's output (an array of names of successfully deleted entities)
export const deleteEntitiesToolOutputSchema = z.array(z.string());