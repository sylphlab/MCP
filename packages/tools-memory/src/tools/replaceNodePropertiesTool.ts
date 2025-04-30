import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, KnowledgeGraph } from '../types'; // Import Node and KnowledgeGraph types
import {
  replaceNodePropertiesToolInputSchema,
  replaceNodePropertiesToolOutputSchema,
} from './replaceNodePropertiesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type ReplaceNodePropertiesInput = z.infer<typeof replaceNodePropertiesToolInputSchema>;

export const replaceNodePropertiesTool = defineTool({
  name: 'replace_node_properties', // Use snake_case
  description: 'Replaces all properties of a specific node in the knowledge graph with a new set of properties.',
  inputSchema: replaceNodePropertiesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: ReplaceNodePropertiesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);
    const { id, properties: newProperties } = args;

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      let updatedNode: Node | undefined = undefined;
      let nodeIndex = -1;

      // Find the index of the node to update
      nodeIndex = currentGraph.nodes.findIndex((node: Node) => node.id === id);

      if (nodeIndex === -1) {
        throw new Error(`Node with ID ${id} not found.`);
      }

      // Get the original node
      const originalNode = currentGraph.nodes[nodeIndex];

      // Replace properties entirely
      updatedNode = { ...originalNode, properties: newProperties };

      // Create a new nodes array with the updated node
      const updatedNodes = [
        ...currentGraph.nodes.slice(0, nodeIndex),
        updatedNode,
        ...currentGraph.nodes.slice(nodeIndex + 1),
      ];

      // Save the updated graph
      const updatedGraph: KnowledgeGraph = { ...currentGraph, nodes: updatedNodes };
      await saveGraph(memoryFilePath, updatedGraph);

      // Return the updated node as a JSON part
      return [jsonPart(updatedNode, replaceNodePropertiesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error replacing node properties.';
      throw new Error(`Failed to replace properties for node ${id}: ${errorMessage}`);
    }
  },
});