import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core'; // Keep Part
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Entity } from '../types'; // Import types
import {
  createEntitiesToolInputSchema,
  createEntitiesToolOutputSchema,
} from './createEntitiesTool.schema.js';

// Infer input type from schema
type CreateEntitiesInput = z.infer<typeof createEntitiesToolInputSchema>;

export const createEntitiesTool = defineTool({
  name: 'createEntities', // Keep the original tool name for consistency
  description: 'Create multiple new entities in the knowledge graph.',
  inputSchema: createEntitiesToolInputSchema,

  execute: async (
    input: CreateEntitiesInput,
    options: MemoryToolExecuteOptions,
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(options.workspaceRoot, options.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const existingNames = new Set(currentGraph.entities.map(e => e.name));
      const newEntities: Entity[] = [];

      for (const entityInput of input.entities) {
        if (!existingNames.has(entityInput.name)) {
          // Ensure observations array exists even if not provided in input
          newEntities.push({ ...entityInput, observations: entityInput.observations ?? [] });
          existingNames.add(entityInput.name); // Add to set to prevent duplicates within the same batch
        }
      }

      if (newEntities.length > 0) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph,
          entities: [...currentGraph.entities, ...newEntities], // Create new array
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      // Validate output against schema before returning
      const validatedOutput = createEntitiesToolOutputSchema.parse(newEntities);
      return [jsonPart(validatedOutput, createEntitiesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during entity creation.';
      throw new Error(`Failed to create entities: ${errorMessage}`);
    }
  },
});