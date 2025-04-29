import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core'; // No ToolContext import needed
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Entity } from '../types'; // Import types
import {
  deleteObservationsToolInputSchema,
  deleteObservationsToolOutputSchema,
} from './deleteObservationsTool.schema.js';

// Infer input type from schema
type DeleteObservationsInput = z.infer<typeof deleteObservationsToolInputSchema>;

import { MemoryContextSchema, type MemoryContext } from '../types.js'; // Import schema and inferred type

// Generic parameters are now inferred from the definition object
export const deleteObservationsTool = defineTool({
  name: 'delete-observations',
  description: 'Delete specific observations from entities in the knowledge graph.',
  inputSchema: deleteObservationsToolInputSchema,
  contextSchema: MemoryContextSchema, // Add the context schema

  execute: async (
    // Context type is inferred from MemoryContextSchema
    { context, args }: { context: MemoryContext; args: DeleteObservationsInput } // Use destructuring
  ): Promise<Part[]> => {
    // context and args are destructured
    // Access options via context
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const results: { entityName: string; deletedCount: number }[] = [];
      let graphChanged = false;

      // Create a mutable copy of entities to modify
      const nextEntities = currentGraph.entities.map(e => ({ ...e, observations: [...e.observations] }));

      // Access input via args
      for (const deletionInput of args.deletions) {
        let deletedCount = 0;
        const entityIndex = nextEntities.findIndex(e => e.name === deletionInput.entityName);

        if (entityIndex !== -1) {
          const entity = nextEntities[entityIndex];
          const observationsToDeleteSet = new Set(deletionInput.observations.filter((obs: string) => typeof obs === 'string'));
          const initialObservationCount = entity.observations.length;
          // Filter observations in the copied entity
          entity.observations = entity.observations.filter((o: string) => !observationsToDeleteSet.has(o));
          deletedCount = initialObservationCount - entity.observations.length;
          if (deletedCount > 0) {
            graphChanged = true;
          }
        } else {
           console.warn(`[deleteObservationsTool] Entity with name ${deletionInput.entityName} not found.`);
        }
        results.push({ entityName: deletionInput.entityName, deletedCount });
      }

      if (graphChanged) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph, // Keep original relations
          entities: nextEntities, // Use the modified entities array
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      const validatedOutput = deleteObservationsToolOutputSchema.parse(results);
      return [jsonPart(validatedOutput, deleteObservationsToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting observations.';
      throw new Error(`Failed to delete observations: ${errorMessage}`);
    }
  },
});