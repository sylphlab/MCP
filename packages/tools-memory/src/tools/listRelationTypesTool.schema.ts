import { z } from 'zod';

// Input schema: No input parameters needed
export const listRelationTypesToolInputSchema = z.object({});

// Output schema: An array of unique relation type strings
export const listRelationTypesToolOutputSchema = z.array(z.string());