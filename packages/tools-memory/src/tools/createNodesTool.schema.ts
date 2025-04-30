import { z } from 'zod';
import { NodeSchema, PropertiesSchema } from '../types.js'; // Import Node and Properties schemas

// Schema for a single node input
const NodeInputSchema = z.object({
  labels: z.array(z.string().min(1)).min(1, { message: "Node must have at least one label." }),
  properties: PropertiesSchema, // Properties are now required
});

// Schema for the tool's input (an array of nodes)
export const createNodesToolInputSchema = z.object({
  nodes: z.array(NodeInputSchema).min(1, { message: "Must provide at least one node to create." }),
});

// Schema for the tool's output (an array of successfully created nodes, including their generated IDs)
export const createNodesToolOutputSchema = z.array(NodeSchema); // Output the full Node object