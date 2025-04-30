import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Edge, KnowledgeGraph } from '../types'; // Import Edge and KnowledgeGraph types
import {
  deleteEdgesToolInputSchema,
  deleteEdgesToolOutputSchema,
} from './deleteEdgesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type DeleteEdgesInput = z.infer<typeof deleteEdgesToolInputSchema>;

export const deleteEdgesTool = defineTool({
  name: 'delete_edges', // New tool name
  description: 'Delete multiple edges (relations) from the knowledge graph based on their type, source node ID, and target node ID.',
  inputSchema: deleteEdgesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async ({ context, args }: { context: MemoryContext; args: DeleteEdgesInput }): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const initialEdgeCount = currentGraph.edges.length;

      // Create a set of keys for edges to delete
      const deleteKeys = new Set(
        args.edges.map(delEdge => `${delEdge.from}|${delEdge.to}|${delEdge.type}`)
      );

      // Filter out edges whose keys are in the delete set
      const nextEdges = currentGraph.edges.filter((edge: Edge) => {
          const edgeKey = `${edge.from}|${edge.to}|${edge.type}`;
          return !deleteKeys.has(edgeKey);
      });

      const deletedCount = initialEdgeCount - nextEdges.length;

      if (deletedCount > 0) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph, // Keep original nodes
          edges: nextEdges, // Use the filtered edges array
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      const validatedOutput = deleteEdgesToolOutputSchema.parse(deletedCount);
      // Return count in a structured way, consistent with potential future multi-part responses
      return [jsonPart({ deletedCount: validatedOutput }, z.object({ deletedCount: deleteEdgesToolOutputSchema }))];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting edges.';
      throw new Error(`Failed to delete edges: ${errorMessage}`);
    }
  },
});