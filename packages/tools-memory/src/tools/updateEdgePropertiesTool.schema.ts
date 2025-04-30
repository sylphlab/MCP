import { z } from 'zod';
import { EdgeSchema, PropertiesSchema } from '../types.js'; // Import Edge and Properties schemas

// Input schema: Requires edge ID and properties to update/add
export const updateEdgePropertiesToolInputSchema = z.object({
  id: z.string().uuid({ message: "Edge ID must be a valid UUID." }),
  properties: PropertiesSchema, // Object containing properties to merge/update
});

// Output schema: The updated Edge object
export const updateEdgePropertiesToolOutputSchema = EdgeSchema;