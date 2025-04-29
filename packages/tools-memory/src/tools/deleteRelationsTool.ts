import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Relation } from '../types'; // Import types
import {
  deleteRelationsToolInputSchema,
  deleteRelationsToolOutputSchema,
} from './deleteRelationsTool.schema.js';

// Infer input type from schema
type DeleteRelationsInput = z.infer<typeof deleteRelationsToolInputSchema>;

export const deleteRelationsTool = defineTool({
  name: 'deleteRelations',
  description: 'Delete multiple relations from the knowledge graph.',
  inputSchema: deleteRelationsToolInputSchema,

  execute: async (
    input: DeleteRelationsInput,
    options: MemoryToolExecuteOptions,
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(options.workspaceRoot, options.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const initialRelationCount = currentGraph.relations.length;

      const deleteKeys = new Set(
        input.relations
            .filter((r: Relation) => r?.from && r?.to && r?.relationType)
            .map((delRelation: Relation) => `${delRelation.from}|${delRelation.to}|${delRelation.relationType}`)
      );

      const nextRelations = currentGraph.relations.filter((r: Relation) => {
          const relationKey = `${r.from}|${r.to}|${r.relationType}`;
          return !deleteKeys.has(relationKey);
      });

      const deletedCount = initialRelationCount - nextRelations.length;

      if (deletedCount > 0) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph, // Keep original entities
          relations: nextRelations, // Use the filtered relations array
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      const validatedOutput = deleteRelationsToolOutputSchema.parse(deletedCount);
      return [jsonPart({ deletedCount: validatedOutput }, z.object({ deletedCount: deleteRelationsToolOutputSchema }))];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting relations.';
      throw new Error(`Failed to delete relations: ${errorMessage}`);
    }
  },
});