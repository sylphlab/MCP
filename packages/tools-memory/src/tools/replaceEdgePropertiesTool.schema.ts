import { z } from 'zod';
import { EdgeSchema, PropertiesSchema } from '../types.js'; // Import Edge and Properties schemas

// Input schema: Requires edge ID and a complete properties object to replace with
export const replaceEdgePropertiesToolInputSchema = z.object({
  id: z.string().uuid({ message: "Edge ID must be a valid UUID." }),
  properties: PropertiesSchema, // The complete new set of properties
});

// Output schema: The updated Edge object
export const replaceEdgePropertiesToolOutputSchema = EdgeSchema;