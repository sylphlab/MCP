import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Edge, KnowledgeGraph } from '../types'; // Import Edge and KnowledgeGraph types
import {
  replaceEdgePropertiesToolInputSchema,
  replaceEdgePropertiesToolOutputSchema,
} from './replaceEdgePropertiesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type ReplaceEdgePropertiesInput = z.infer<typeof replaceEdgePropertiesToolInputSchema>;

export const replaceEdgePropertiesTool = defineTool({
  name: 'replace_edge_properties', // Use snake_case
  description: 'Replaces all properties of a specific edge in the knowledge graph with a new set of properties.',
  inputSchema: replaceEdgePropertiesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: ReplaceEdgePropertiesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);
    const { id, properties: newProperties } = args;

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      let updatedEdge: Edge | undefined = undefined;
      let edgeIndex = -1;

      // Find the index of the edge to update
      edgeIndex = currentGraph.edges.findIndex((edge: Edge) => edge.id === id);

      if (edgeIndex === -1) {
        throw new Error(`Edge with ID ${id} not found.`);
      }

      // Get the original edge
      const originalEdge = currentGraph.edges[edgeIndex];

      // Replace properties entirely
      updatedEdge = { ...originalEdge, properties: newProperties };

      // Create a new edges array with the updated edge
      const updatedEdges = [
        ...currentGraph.edges.slice(0, edgeIndex),
        updatedEdge,
        ...currentGraph.edges.slice(edgeIndex + 1),
      ];

      // Save the updated graph
      const updatedGraph: KnowledgeGraph = { ...currentGraph, edges: updatedEdges };
      await saveGraph(memoryFilePath, updatedGraph);

      // Return the updated edge as a JSON part
      return [jsonPart(updatedEdge, replaceEdgePropertiesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error replacing edge properties.';
      throw new Error(`Failed to replace properties for edge ${id}: ${errorMessage}`);
    }
  },
});