import { z } from 'zod';
import { NodeSchema } from '../types.js'; // Import the Node schema

// Input schema: Requires node ID and an array of labels to add
export const addNodeLabelsToolInputSchema = z.object({
  id: z.string().uuid({ message: "Node ID must be a valid UUID." }),
  labels: z.array(z.string().min(1)).min(1, { message: "Must provide at least one label to add." }),
});

// Output schema: The updated Node object
export const addNodeLabelsToolOutputSchema = NodeSchema;