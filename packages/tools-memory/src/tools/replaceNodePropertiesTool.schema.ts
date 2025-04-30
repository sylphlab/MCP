import { z } from 'zod';
import { NodeSchema, PropertiesSchema } from '../types.js'; // Import Node and Properties schemas

// Input schema: Requires node ID and a complete properties object to replace with
export const replaceNodePropertiesToolInputSchema = z.object({
  id: z.string().uuid({ message: "Node ID must be a valid UUID." }),
  properties: PropertiesSchema, // The complete new set of properties
});

// Output schema: The updated Node object
export const replaceNodePropertiesToolOutputSchema = NodeSchema;