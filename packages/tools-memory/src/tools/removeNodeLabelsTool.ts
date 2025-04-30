import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, KnowledgeGraph } from '../types'; // Import Node and KnowledgeGraph types
import {
  removeNodeLabelsToolInputSchema,
  removeNodeLabelsToolOutputSchema,
} from './removeNodeLabelsTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type RemoveNodeLabelsInput = z.infer<typeof removeNodeLabelsToolInputSchema>;

export const removeNodeLabelsTool = defineTool({
  name: 'remove_node_labels', // Use snake_case
  description: 'Removes one or more labels from a specific node in the knowledge graph. Ensures at least one label remains.',
  inputSchema: removeNodeLabelsToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: RemoveNodeLabelsInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);
    const { id, labels: labelsToRemove } = args;
    const labelsToRemoveSet = new Set(labelsToRemove);

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

      // Filter out labels to remove
      const updatedLabels = originalNode.labels.filter(label => !labelsToRemoveSet.has(label));

      // Ensure at least one label remains
      if (updatedLabels.length === 0) {
        throw new Error(`Cannot remove all labels from node ${id}. At least one label must remain.`);
      }

      // Only update if labels actually changed
      if (updatedLabels.length === originalNode.labels.length) {
         updatedNode = originalNode; // No change needed
      } else {
         updatedNode = { ...originalNode, labels: updatedLabels };

         // Create a new nodes array with the updated node
         const updatedNodes = [
           ...currentGraph.nodes.slice(0, nodeIndex),
           updatedNode,
           ...currentGraph.nodes.slice(nodeIndex + 1),
         ];

         // Save the updated graph
         const updatedGraph: KnowledgeGraph = { ...currentGraph, nodes: updatedNodes };
         await saveGraph(memoryFilePath, updatedGraph);
      }

      // Return the updated node as a JSON part
      return [jsonPart(updatedNode, removeNodeLabelsToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error removing labels from node.';
      throw new Error(`Failed to remove labels from node ${id}: ${errorMessage}`);
    }
  },
});