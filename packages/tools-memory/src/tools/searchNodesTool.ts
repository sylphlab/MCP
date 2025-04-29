import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core'; // No ToolContext import needed
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Entity, Relation } from '../types'; // Import types
import {
  searchNodesToolInputSchema,
  searchNodesToolOutputSchema,
} from './searchNodesTool.schema.js';

// Infer input type from schema
type SearchNodesInput = z.infer<typeof searchNodesToolInputSchema>;

import { MemoryContextSchema, type MemoryContext } from '../types.js'; // Import schema and inferred type

// Generic parameters are now inferred from the definition object
export const searchNodesTool = defineTool({
  name: 'search-nodes',
  description: 'Search for nodes (entities and relations) in the knowledge graph based on a query.',
  inputSchema: searchNodesToolInputSchema,
  contextSchema: MemoryContextSchema, // Add the context schema

  execute: async (
    // Context type is inferred from MemoryContextSchema
    { context, args }: { context: MemoryContext; args: SearchNodesInput } // Use destructuring
  ): Promise<Part[]> => {
    // context and args are destructured
    // Access options via context
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      // Access input via args
      const lowerCaseQuery = args.query.toLowerCase();

      const filteredEntities = currentGraph.entities.filter((e: Entity) =>
        e.name.toLowerCase().includes(lowerCaseQuery) ||
        e.entityType.toLowerCase().includes(lowerCaseQuery) ||
        e.observations.some((o: string) => o.toLowerCase().includes(lowerCaseQuery))
      );

      const filteredEntityNames = new Set(filteredEntities.map((e: Entity) => e.name));

      const filteredRelations = currentGraph.relations.filter((r: Relation) =>
        filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
      );

      const searchResults: KnowledgeGraph = {
        entities: filteredEntities,
        relations: filteredRelations,
      };

      const validatedOutput = searchNodesToolOutputSchema.parse(searchResults);
      return [jsonPart(validatedOutput, searchNodesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error searching nodes.';
      throw new Error(`Failed to search nodes: ${errorMessage}`);
    }
  },
});