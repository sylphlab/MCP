import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Edge, KnowledgeGraph } from '../types'; // Import Edge and KnowledgeGraph types
import {
  updateEdgePropertiesToolInputSchema,
  updateEdgePropertiesToolOutputSchema,
} from './updateEdgePropertiesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type UpdateEdgePropertiesInput = z.infer<typeof updateEdgePropertiesToolInputSchema>;

export const updateEdgePropertiesTool = defineTool({
  name: 'update_edge_properties', // Use snake_case
  description: 'Updates (merges) properties for a specific edge in the knowledge graph.',
  inputSchema: updateEdgePropertiesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: UpdateEdgePropertiesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);
    const { id, properties: propertiesToUpdate } = args;

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      let updatedEdge: Edge | undefined = undefined;
      let edgeIndex = -1;

      // Find the index of the edge to update
      edgeIndex = currentGraph.edges.findIndex((edge: Edge) => edge.id === id);

      if (edgeIndex === -1) {
        throw new Error(`Edge with ID ${id} not found.`); // Throw error if not found
      }

      // Get the original edge
      const originalEdge = currentGraph.edges[edgeIndex];

      // Merge new properties into existing ones (new values overwrite old ones)
      const mergedProperties = { ...originalEdge.properties, ...propertiesToUpdate };
      updatedEdge = { ...originalEdge, properties: mergedProperties };

      // Create a new edges array with the updated edge
      const updatedEdges = [
        ...currentGraph.edges.slice(0, edgeIndex),
        updatedEdge, // updatedEdge is guaranteed to be an Edge here
        ...currentGraph.edges.slice(edgeIndex + 1),
      ];

      // Save the updated graph
      const updatedGraph: KnowledgeGraph = { ...currentGraph, edges: updatedEdges };
      await saveGraph(memoryFilePath, updatedGraph);

      // Return the updated edge as a JSON part
      return [jsonPart(updatedEdge, updateEdgePropertiesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error updating edge properties.';
      throw new Error(`Failed to update properties for edge ${id}: ${errorMessage}`);
    }
  },
});