import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, Edge, KnowledgeGraph } from '../types'; // Import Node, Edge, KnowledgeGraph types
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
        return [jsonPart({ nodes: [], totalCount: 0 }, findRelatedNodesToolOutputSchema)];
      }

      const relatedNodeIds = new Set<string>();

      for (const edge of currentGraph.edges) {
        // Filter by relation_type first
        if (relation_type && edge.type !== relation_type) {
          continue;
        }

        let potentialTargetId: string | null = null;
        let isOutgoingMatch = false;

        // Check outgoing
        if ((direction === 'outgoing' || direction === 'both') && edge.from === start_node_id) {
            potentialTargetId = edge.to;
            isOutgoingMatch = true;
        }

        // Check incoming (only if direction allows)
        if ((direction === 'incoming' || direction === 'both') && edge.to === start_node_id) {
            const incomingTargetId = edge.from;
            // If outgoing didn't match OR incoming target is different from outgoing target
            if (!isOutgoingMatch || incomingTargetId !== potentialTargetId) {
                // If outgoing didn't match, set potentialTargetId for label check later
                if (!isOutgoingMatch) {
                    potentialTargetId = incomingTargetId;
                }
                // If outgoing DID match, but incoming is different, add incoming directly after label check
                else if (incomingTargetId !== start_node_id) { // Avoid adding start node
                     if (!end_node_label || nodesById.get(incomingTargetId)?.labels.includes(end_node_label)) {
                         relatedNodeIds.add(incomingTargetId);
                     }
                }
            }
             // If outgoing matched AND incoming is the same (self-loop in 'both' mode), potentialTargetId remains the outgoing target, do nothing here.
        }

        // Apply filters and add the primary potentialTargetId (if found and not start node)
        if (potentialTargetId && potentialTargetId !== start_node_id) {
             if (!end_node_label || nodesById.get(potentialTargetId)?.labels.includes(end_node_label)) {
                 relatedNodeIds.add(potentialTargetId);
             }
        }

      } // End of for...of loop

      // Get the actual node objects
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
      // Include start_node_id in the error message
      throw new Error(`Failed to find related nodes for ${start_node_id}: ${errorMessage}`);
    }
  },
});