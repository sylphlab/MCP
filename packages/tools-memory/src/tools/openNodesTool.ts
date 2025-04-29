import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Entity, Relation } from '../types'; // Import types
import {
  openNodesToolInputSchema,
  openNodesToolOutputSchema,
} from './openNodesTool.schema.js';

// Infer input type from schema
type OpenNodesInput = z.infer<typeof openNodesToolInputSchema>;

export const openNodesTool = defineTool({
  name: 'open-nodes',
  description: 'Retrieve specific entities and their direct relations from the knowledge graph by name.',
  inputSchema: openNodesToolInputSchema,

  execute: async (
    input: OpenNodesInput,
    options: MemoryToolExecuteOptions,
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(options.workspaceRoot, options.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const namesToOpenSet = new Set(input.names.filter((name: string) => typeof name === 'string'));

      const filteredEntities = currentGraph.entities.filter((e: Entity) => namesToOpenSet.has(e.name));
      const filteredEntityNames = new Set(filteredEntities.map((e: Entity) => e.name));

      const filteredRelations = currentGraph.relations.filter((r: Relation) =>
        filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
      );

      const openResults: KnowledgeGraph = {
        entities: filteredEntities,
        relations: filteredRelations,
      };

      const validatedOutput = openNodesToolOutputSchema.parse(openResults);
      return [jsonPart(validatedOutput, openNodesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error opening nodes.';
      throw new Error(`Failed to open nodes: ${errorMessage}`);
    }
  },
});