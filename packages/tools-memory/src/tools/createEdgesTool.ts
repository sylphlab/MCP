import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Edge, KnowledgeGraph, Node } from '../types'; // Import Edge, KnowledgeGraph, Node types
import {
  createEdgesToolInputSchema,
  createEdgesToolOutputSchema,
} from './createEdgesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';
import crypto from 'node:crypto'; // Import crypto for UUID generation

// Infer input type from schema
type CreateEdgesInput = z.infer<typeof createEdgesToolInputSchema>;

export const createEdgesTool = defineTool({
  name: 'create_edges', // New tool name
  description: 'Create multiple new edges (relations) between nodes in the knowledge graph.',
  inputSchema: createEdgesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: CreateEdgesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const existingNodeIds = new Set(currentGraph.nodes.map((n: Node) => n.id));
      // Check for existing edges based on type, from, and to
      const existingEdgeSet = new Set(currentGraph.edges.map((e: Edge) => `${e.from}|${e.to}|${e.type}`));
      // Keep track of existing edge IDs if they exist
      const existingEdgeIds = new Set(currentGraph.edges.map((e: Edge) => e.id));
      const newEdges: Edge[] = [];

      for (const edgeInput of args.edges) {
        // Validate that 'from' and 'to' nodes exist
        if (!existingNodeIds.has(edgeInput.from)) {
          console.warn(`[createEdgesTool] Skipping edge creation: 'from' node with ID ${edgeInput.from} does not exist.`);
          continue;
        }
        if (!existingNodeIds.has(edgeInput.to)) {
          console.warn(`[createEdgesTool] Skipping edge creation: 'to' node with ID ${edgeInput.to} does not exist.`);
          continue;
        }

        const edgeKey = `${edgeInput.from}|${edgeInput.to}|${edgeInput.type}`;
        if (!existingEdgeSet.has(edgeKey)) {
          let newEdgeId: string;
          // Generate a unique UUID for the edge
          do {
            newEdgeId = crypto.randomUUID();
          } while (existingEdgeIds.has(newEdgeId));

          const newEdge: Edge = {
            id: newEdgeId, // Assign generated ID
            type: edgeInput.type,
            from: edgeInput.from,
            to: edgeInput.to,
            // Include properties if provided, otherwise it will be undefined (matching schema optional)
            ...(edgeInput.properties && { properties: edgeInput.properties }),
          };
          newEdges.push(newEdge);
          existingEdgeSet.add(edgeKey);
          existingEdgeIds.add(newEdgeId); // Add new ID to set
        } else {
           console.warn(`[createEdgesTool] Skipping duplicate edge creation: ${edgeKey}`);
        }
      }

      if (newEdges.length > 0) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph,
          edges: [...currentGraph.edges, ...newEdges], // Add new edges
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      const validatedOutput = createEdgesToolOutputSchema.parse(newEdges);
      return [jsonPart(validatedOutput, createEdgesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during edge creation.';
      throw new Error(`Failed to create edges: ${errorMessage}`);
    }
  },
});