import { z } from 'zod';

// Schema for a single entity input
const EntityInputSchema = z.object({
  name: z.string().min(1, { message: "Entity name cannot be empty." }),
  entityType: z.string().min(1, { message: "Entity type cannot be empty." }),
  observations: z.array(z.string()).optional().default([]), // Observations are optional
});

// Schema for the tool's input (an array of entities)
export const createEntitiesToolInputSchema = z.object({
  entities: z.array(EntityInputSchema).min(1, { message: "Must provide at least one entity to create." }),
});

// Schema for a single entity output (matches the Entity interface)
export const EntityOutputSchema = z.object({
    name: z.string(),
    entityType: z.string(),
    observations: z.array(z.string()),
});

// Schema for the tool's output (an array of successfully created entities)
export const createEntitiesToolOutputSchema = z.array(EntityOutputSchema);