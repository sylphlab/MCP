import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node } from '../types'; // Import the new Node type
import {
  listNodesToolInputSchema,
  listNodesToolOutputSchema, // Keep schema import for jsonPart
} from './listNodesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type ListNodesInput = z.infer<typeof listNodesToolInputSchema>;

export const listNodesTool = defineTool({
  name: 'list_nodes', // Use snake_case
  description: 'Lists nodes (entities) from the knowledge graph, optionally filtering by a specific label (entity type) and applying pagination.',
  inputSchema: listNodesToolInputSchema,
  // No outputSchema property for defineTool
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: ListNodesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const filterLabel = args.entity_type; // Store the optional label

      // Filter nodes by label if provided
      const filteredNodes = filterLabel
        ? currentGraph.nodes.filter((node: Node) => node.labels.includes(filterLabel)) // Use the stored variable safely
        : currentGraph.nodes;

      const totalCount = filteredNodes.length;

      // Apply pagination (limit and offset)
      // Ensure limit and offset are accessed correctly from args (they have defaults)
      const offset = args.offset ?? 0;
      const limit = args.limit ?? 50;
      const paginatedNodes = filteredNodes.slice(offset, offset + limit);

      const result = {
        nodes: paginatedNodes,
        totalCount: totalCount,
      };

      // Return the result as a JSON part
      return [jsonPart(result, listNodesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error listing nodes.';
      throw new Error(`Failed to list nodes: ${errorMessage}`);
    }
  },
});