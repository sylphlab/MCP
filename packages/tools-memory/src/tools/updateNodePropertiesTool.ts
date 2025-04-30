import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node } from '../types'; // Import the new Node type
import {
  updateNodePropertiesToolInputSchema,
  updateNodePropertiesToolOutputSchema, // Keep schema import for jsonPart
} from './updateNodePropertiesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type UpdateNodePropertiesInput = z.infer<typeof updateNodePropertiesToolInputSchema>;

export const updateNodePropertiesTool = defineTool({
  name: 'update_node_properties', // Use snake_case
  description: 'Updates (merges) properties for a specific node in the knowledge graph.',
  inputSchema: updateNodePropertiesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: UpdateNodePropertiesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);
    const { id, properties: propertiesToUpdate } = args;

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      let updatedNode: Node | undefined = undefined; // Use undefined instead of null
      let nodeIndex = -1;

      // Find the index of the node to update
      nodeIndex = currentGraph.nodes.findIndex((node: Node) => node.id === id);

      if (nodeIndex === -1) {
        throw new Error(`Node with ID ${id} not found.`); // Throw error if not found
      }

      // Get the original node
      const originalNode = currentGraph.nodes[nodeIndex];

      // Merge new properties into existing ones (new values overwrite old ones)
      const mergedProperties = { ...originalNode.properties, ...propertiesToUpdate };
      updatedNode = { ...originalNode, properties: mergedProperties };

      // Create a new nodes array with the updated node
      const updatedNodes = [
        ...currentGraph.nodes.slice(0, nodeIndex),
        updatedNode, // updatedNode is guaranteed to be a Node here
        ...currentGraph.nodes.slice(nodeIndex + 1),
      ];


      // Save the updated graph
      const updatedGraph = { ...currentGraph, nodes: updatedNodes };
      await saveGraph(memoryFilePath, updatedGraph);

      // Return the updated node as a JSON part
      // Since we throw an error if not found, updatedNode is guaranteed to be a Node here
      return [jsonPart(updatedNode, updateNodePropertiesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error updating node properties.';
      throw new Error(`Failed to update properties for node ${id}: ${errorMessage}`);
    }
  },
});