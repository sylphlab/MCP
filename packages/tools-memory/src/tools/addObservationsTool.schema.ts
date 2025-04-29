import { z } from 'zod';

// Schema for a single observation input object
const ObservationInputSchema = z.object({
  entityName: z.string().min(1, { message: "Entity name cannot be empty." }),
  contents: z.array(z.string().min(1, { message: "Observation content cannot be empty." }))
             .min(1, { message: "Must provide at least one observation content string." }),
});

// Schema for the tool's input (an array of observation objects)
export const addObservationsToolInputSchema = z.object({
  observations: z.array(ObservationInputSchema).min(1, { message: "Must provide at least one observation object to add." }),
});

// Schema for a single observation output object
export const ObservationOutputSchema = z.object({
    entityName: z.string(),
    addedObservations: z.array(z.string()), // Reports only the observations that were actually added (new)
});

// Schema for the tool's output (an array of observation output objects)
export const addObservationsToolOutputSchema = z.array(ObservationOutputSchema);