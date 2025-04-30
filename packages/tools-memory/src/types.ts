import { BaseContextSchema } from '@sylphlab/tools-core';
import type { ToolExecuteOptions as CoreToolExecuteOptions } from '@sylphlab/tools-core';
import { z } from 'zod';

/**
 * Extends the core ToolExecuteOptions to include memory-specific options.
 */
export interface MemoryToolExecuteOptions extends CoreToolExecuteOptions {
  /** Optional override for the memory file path. */
  memoryFilePath?: string;
}

/**
 * Zod schema corresponding to MemoryToolExecuteOptions.
 */
export const MemoryContextSchema = BaseContextSchema.extend({
  memoryFilePath: z.string().optional(),
});
export type MemoryContext = z.infer<typeof MemoryContextSchema>;


// --- Knowledge Graph Specific Types (Property Graph Model) ---

// Define allowed property value types
const PropertyValueSchema = z.any();
type PropertyValue = z.infer<typeof PropertyValueSchema>; // Keep internal if only used via Properties

// Define the Properties object schema
export const PropertiesSchema = z.record(PropertyValueSchema);
export type Properties = z.infer<typeof PropertiesSchema>;

// Define the Node (Entity) interface and schema
export const NodeSchema = z.object({
  id: z.string().uuid({ message: "Node ID must be a valid UUID." }),
  labels: z.array(z.string().min(1)).min(1, { message: "Node must have at least one label." }),
  properties: PropertiesSchema,
});
export type Node = z.infer<typeof NodeSchema>;

// Define the Edge (Relation) interface and schema
export const EdgeSchema = z.object({
  id: z.string().uuid({ message: "Edge ID must be a valid UUID." }), // ADDED Edge ID
  type: z.string().min(1, { message: "Edge must have a type." }),
  from: z.string().uuid({ message: "Edge 'from' must be a valid Node UUID." }),
  to: z.string().uuid({ message: "Edge 'to' must be a valid Node UUID." }),
  properties: PropertiesSchema.optional(),
});
export type Edge = z.infer<typeof EdgeSchema>;

// Define the KnowledgeGraph interface and schema (now storing nodes and edges)
export const KnowledgeGraphSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});
export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;