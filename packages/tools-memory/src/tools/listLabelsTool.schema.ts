import { z } from 'zod';

// Input schema: No input parameters needed
export const listLabelsToolInputSchema = z.object({});

// Output schema: An array of unique label strings
export const listLabelsToolOutputSchema = z.array(z.string());