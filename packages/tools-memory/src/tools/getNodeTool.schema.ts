import { z } from 'zod';
import { NodeSchema } from '../types.js'; // Import the Node schema

// Input schema: Requires a node ID (UUID)
export const getNodeToolInputSchema = z.object({
  id: z.string().uuid({ message: "Node ID must be a valid UUID." }),
});

// Output schema: A single Node object or null if not found
// We'll return the Node object directly in the jsonPart,
// but define the schema here for clarity and potential validation.
// Allowing null might be useful if not finding the node isn't considered an error.
export const getNodeToolOutputSchema = NodeSchema.nullable();