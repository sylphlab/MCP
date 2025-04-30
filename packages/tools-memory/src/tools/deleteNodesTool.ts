import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import { z } from 'zod'; // Keep z for parsing
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, Edge, KnowledgeGraph } from '../types'; // Import Node, Edge, KnowledgeGraph types
import {
  deleteNodesToolInputSchema,
  deleteNodesToolOutputSchema,
} from './deleteNodesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type DeleteNodesInput = z.infer<typeof deleteNodesToolInputSchema>;

export const deleteNodesTool = defineTool({
  name: 'delete_nodes', // New tool name
  description: 'Delete multiple nodes (entities) and their associated edges (relations) from the knowledge graph by their IDs.',
  inputSchema: deleteNodesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: DeleteNodesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const idsToDeleteSet = new Set(args.nodeIds);
      const actualDeletedNodeIds: string[] = []; // Store actual UUIDs of deleted nodes

      // Filter out nodes to be deleted
      const nextNodes = currentGraph.nodes.filter((node: Node) => {
        if (idsToDeleteSet.has(node.id)) {
          actualDeletedNodeIds.push(node.id); // Store the actual UUID
          return false; // Exclude this node
        }
        return true; // Keep this node
      });

      // Filter out edges connected to the deleted nodes
      const nextEdges = currentGraph.edges.filter((edge: Edge) =>
        !idsToDeleteSet.has(edge.from) && !idsToDeleteSet.has(edge.to)
      );

      // Check if anything actually changed
      const graphChanged = nextNodes.length !== currentGraph.nodes.length ||
                           nextEdges.length !== currentGraph.edges.length;

      if (graphChanged) {
        const nextGraph: KnowledgeGraph = {
          nodes: nextNodes,
          edges: nextEdges,
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      // Parse the list of actual deleted UUIDs against the output schema
      const validatedOutput = deleteNodesToolOutputSchema.parse(actualDeletedNodeIds);
      return [jsonPart(validatedOutput, deleteNodesToolOutputSchema)];

    } catch (error: unknown) {
      // Keep original error message structure for now, fix assertion later if needed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting nodes.';
      throw new Error(`Failed to delete nodes: ${errorMessage}`);
    }
  },
});