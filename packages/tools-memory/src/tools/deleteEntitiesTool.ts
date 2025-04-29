import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Entity, Relation } from '../types'; // Import types
import {
  deleteEntitiesToolInputSchema,
  deleteEntitiesToolOutputSchema,
} from './deleteEntitiesTool.schema.js';

// Infer input type from schema
type DeleteEntitiesInput = z.infer<typeof deleteEntitiesToolInputSchema>;

export const deleteEntitiesTool = defineTool({
  name: 'delete-entities',
  description: 'Delete multiple entities and their associated relations from the knowledge graph.',
  inputSchema: deleteEntitiesToolInputSchema,

  execute: async (
    input: DeleteEntitiesInput,
    options: MemoryToolExecuteOptions,
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(options.workspaceRoot, options.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const namesToDeleteSet = new Set(input.entityNames);
      const deletedEntityNames: string[] = [];

      const nextEntities = currentGraph.entities.filter((e: Entity) => {
        if (namesToDeleteSet.has(e.name)) {
          deletedEntityNames.push(e.name);
          return false;
        }
        return true;
      });

      const nextRelations = currentGraph.relations.filter((r: Relation) =>
        !namesToDeleteSet.has(r.from) && !namesToDeleteSet.has(r.to)
      );

      const graphChanged = nextEntities.length !== currentGraph.entities.length ||
                           nextRelations.length !== currentGraph.relations.length;

      if (graphChanged) {
        const nextGraph: KnowledgeGraph = {
          entities: nextEntities,
          relations: nextRelations,
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      const validatedOutput = deleteEntitiesToolOutputSchema.parse(deletedEntityNames);
      return [jsonPart(validatedOutput, deleteEntitiesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting entities.';
      throw new Error(`Failed to delete entities: ${errorMessage}`);
    }
  },
});