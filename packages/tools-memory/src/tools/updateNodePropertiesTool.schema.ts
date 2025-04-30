import { z } from 'zod';
import { NodeSchema, PropertiesSchema } from '../types.js'; // Import Node and Properties schemas

// Input schema: Requires node ID and properties to update/add
export const updateNodePropertiesToolInputSchema = z.object({
  id: z.string().uuid({ message: "Node ID must be a valid UUID." }),
  properties: PropertiesSchema, // Object containing properties to merge/update
});

// Output schema: The updated Node object
export const updateNodePropertiesToolOutputSchema = NodeSchema;