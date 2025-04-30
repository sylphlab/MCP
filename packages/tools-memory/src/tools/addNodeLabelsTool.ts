import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, KnowledgeGraph } from '../types'; // Import Node and KnowledgeGraph types
import {
  addNodeLabelsToolInputSchema,
  addNodeLabelsToolOutputSchema,
} from './addNodeLabelsTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type AddNodeLabelsInput = z.infer<typeof addNodeLabelsToolInputSchema>;

export const addNodeLabelsTool = defineTool({
  name: 'add_node_labels', // Use snake_case
  description: 'Adds one or more labels to a specific node in the knowledge graph.',
  inputSchema: addNodeLabelsToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: AddNodeLabelsInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);
    const { id, labels: labelsToAdd } = args;

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

      // Add new labels, ensuring uniqueness
      const newLabelsSet = new Set([...originalNode.labels, ...labelsToAdd]);
      const updatedLabels = Array.from(newLabelsSet);

      // Only update if labels actually changed
      if (updatedLabels.length === originalNode.labels.length && updatedLabels.every(l => originalNode.labels.includes(l))) {
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
      return [jsonPart(updatedNode, addNodeLabelsToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error adding labels to node.';
      throw new Error(`Failed to add labels to node ${id}: ${errorMessage}`);
    }
  },
});