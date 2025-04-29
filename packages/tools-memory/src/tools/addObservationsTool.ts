import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Entity } from '../types'; // Import types
import {
  addObservationsToolInputSchema,
  addObservationsToolOutputSchema,
} from './addObservationsTool.schema.js';

// Infer input type from schema
type AddObservationsInput = z.infer<typeof addObservationsToolInputSchema>;

export const addObservationsTool = defineTool({
  name: 'add-observations',
  description: 'Add new observations to existing entities in the knowledge graph.',
  inputSchema: addObservationsToolInputSchema,

  execute: async (
    input: AddObservationsInput,
    options: MemoryToolExecuteOptions,
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(options.workspaceRoot, options.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const results: { entityName: string; addedObservations: string[] }[] = [];
      let graphChanged = false;

      // Create a mutable copy of entities to modify
      const nextEntities = currentGraph.entities.map(e => ({ ...e, observations: [...e.observations] }));

      for (const obsInput of input.observations) {
        const entityIndex = nextEntities.findIndex(e => e.name === obsInput.entityName);
        if (entityIndex === -1) {
          // Throw error if entity not found, as per original manager logic
          throw new Error(`Entity with name '${obsInput.entityName}' not found.`);
        }

        const entity = nextEntities[entityIndex];
        const currentObservations = new Set(entity.observations);
        const newObservations = obsInput.contents.filter(content => typeof content === 'string' && !currentObservations.has(content));

        if (newObservations.length > 0) {
          entity.observations.push(...newObservations); // Modify the copied entity
          results.push({ entityName: obsInput.entityName, addedObservations: newObservations });
          graphChanged = true;
        } else {
          results.push({ entityName: obsInput.entityName, addedObservations: [] });
        }
      }

      if (graphChanged) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph,
          entities: nextEntities, // Use the modified entities array
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      const validatedOutput = addObservationsToolOutputSchema.parse(results);
      return [jsonPart(validatedOutput, addObservationsToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error adding observations.';
       if (errorMessage.includes('not found')) {
          throw new Error(`Failed to add observations: ${errorMessage} Please ensure the entity exists before adding observations.`);
       }
      throw new Error(`Failed to add observations: ${errorMessage}`);
    }
  },
});