import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, Edge } from '../types'; // Import Node and Edge types
import {
  findRelatedNodesToolInputSchema,
  findRelatedNodesToolOutputSchema, // Keep schema import for jsonPart
} from './findRelatedNodesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type FindRelatedNodesInput = z.infer<typeof findRelatedNodesToolInputSchema>;

export const findRelatedNodesTool = defineTool({
  name: 'find_related_nodes', // Use snake_case
  description: 'Finds nodes related to a starting node via edges, allowing filtering by direction, relation type, and end node label, with pagination.',
  inputSchema: findRelatedNodesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: FindRelatedNodesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);
    const {
      start_node_id,
      direction = 'both',
      relation_type,
      end_node_label,
      limit = 50,
      offset = 0
    } = args;

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const nodesById = new Map(currentGraph.nodes.map(node => [node.id, node]));

      // Check if start node exists
      if (!nodesById.has(start_node_id)) {
        // Or throw an error? Returning empty list for now.
        return [jsonPart({ nodes: [], totalCount: 0 }, findRelatedNodesToolOutputSchema)];
      }

      const relatedNodeIds = new Set<string>();

      // Use for...of instead of forEach
      for (const edge of currentGraph.edges) {
        let targetNodeId: string | null = null;

        // Filter by direction and relation_type
        if (relation_type && edge.type !== relation_type) {
          continue; // Skip if relation type doesn't match
        }

        if ((direction === 'outgoing' || direction === 'both') && edge.from === start_node_id) {
          targetNodeId = edge.to;
        } else if ((direction === 'incoming' || direction === 'both') && edge.to === start_node_id) {
          targetNodeId = edge.from;
        }

        // If a potential related node is found, check its label if needed
        if (targetNodeId) {
          if (end_node_label) {
            const targetNode = nodesById.get(targetNodeId);
            // Use optional chaining
            if (targetNode?.labels.includes(end_node_label)) {
              relatedNodeIds.add(targetNodeId);
            }
          } else {
            relatedNodeIds.add(targetNodeId);
          }
        }
      } // End of for...of loop

      // Get the actual node objects, filter out potential missing nodes (if edge points to non-existent node)
      const relatedNodes = Array.from(relatedNodeIds)
                                .map(id => nodesById.get(id))
                                .filter((node): node is Node => node !== undefined);

      const totalCount = relatedNodes.length;
      const paginatedNodes = relatedNodes.slice(offset, offset + limit);

      const result = {
        nodes: paginatedNodes,
        totalCount: totalCount,
      };

      return [jsonPart(result, findRelatedNodesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error finding related nodes.';
      throw new Error(`Failed to find related nodes for ${start_node_id}: ${errorMessage}`);
    }
  },
});