import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core'; // No ToolContext import needed
import { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Relation } from '../types'; // Import types
import {
  deleteRelationsToolInputSchema,
  deleteRelationsToolOutputSchema,
} from './deleteRelationsTool.schema.js';

// Infer input type from schema
type DeleteRelationsInput = z.infer<typeof deleteRelationsToolInputSchema>;

import { MemoryContextSchema, type MemoryContext } from '../types.js'; // Import schema and inferred type

// Generic parameters are now inferred from the definition object
export const deleteRelationsTool = defineTool({
  name: 'delete-relations',
  description: 'Delete multiple relations from the knowledge graph.',
  inputSchema: deleteRelationsToolInputSchema,
  contextSchema: MemoryContextSchema, // Add the context schema

  execute: async ({ context, args }): Promise<Part[]> => {
    // context and args are destructured
    // Access options via context
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const initialRelationCount = currentGraph.relations.length;

      // Access input via args
      const deleteKeys = new Set(
        args.relations
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