import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, KnowledgeGraph } from '../types'; // Import Node and KnowledgeGraph types
import {
  createNodesToolInputSchema,
  createNodesToolOutputSchema,
} from './createNodesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';
import crypto from 'node:crypto'; // Import crypto for UUID generation

// Infer input type from schema
type CreateNodesInput = z.infer<typeof createNodesToolInputSchema>;

export const createNodesTool = defineTool({
  name: 'create_nodes', // New tool name
  description: 'Create multiple new nodes (entities) with labels and properties in the knowledge graph.',
  inputSchema: createNodesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: CreateNodesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const newNodes: Node[] = [];
      // Keep track of existing IDs to ensure generated UUIDs are unique (highly unlikely collision, but good practice)
      const existingIds = new Set(currentGraph.nodes.map(n => n.id));

      for (const nodeInput of args.nodes) {
        let newNodeId: string;
        // Generate a unique UUID
        do {
          newNodeId = crypto.randomUUID();
        } while (existingIds.has(newNodeId));

        const newNode: Node = {
          id: newNodeId,
          labels: nodeInput.labels,
          properties: nodeInput.properties,
        };
        newNodes.push(newNode);
        existingIds.add(newNodeId); // Add newly generated ID to the set
      }

      if (newNodes.length > 0) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph,
          nodes: [...currentGraph.nodes, ...newNodes], // Add new nodes
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      // Validate output against schema before returning
      const validatedOutput = createNodesToolOutputSchema.parse(newNodes);
      return [jsonPart(validatedOutput, createNodesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during node creation.';
      throw new Error(`Failed to create nodes: ${errorMessage}`);
    }
  },
});