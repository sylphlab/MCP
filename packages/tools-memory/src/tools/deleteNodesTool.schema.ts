import { z } from 'zod';

// Schema for the tool's input (an array of node IDs)
export const deleteNodesToolInputSchema = z.object({
  nodeIds: z.array(z.string().uuid({ message: "Node ID must be a valid UUID." }))
            .min(1, { message: "Must provide at least one node ID to delete." }),
});

// Schema for the tool's output (an array of IDs of successfully deleted nodes)
export const deleteNodesToolOutputSchema = z.array(z.string().uuid());