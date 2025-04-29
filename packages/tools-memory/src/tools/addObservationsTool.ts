import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
import {
  addObservationsToolInputSchema,
  addObservationsToolOutputSchema,
} from './addObservationsTool.schema.js';

// Infer input type from schema
type AddObservationsInput = z.infer<typeof addObservationsToolInputSchema>;

export const addObservationsTool = defineTool({
  name: 'addObservations',
  description: 'Add new observations to existing entities in the knowledge graph.',
  inputSchema: addObservationsToolInputSchema,

  execute: async (
    input: AddObservationsInput,
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Use memoryFilePath from options
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const addedResults = await manager.addObservations(input.observations);
      const validatedOutput = addObservationsToolOutputSchema.parse(addedResults);
      return [jsonPart(validatedOutput, addObservationsToolOutputSchema)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error adding observations.';
      // Check for specific error like "Entity not found"
      if (errorMessage.includes('not found')) {
         throw new Error(`Failed to add observations: ${errorMessage} Please ensure the entity exists before adding observations.`);
      }
      throw new Error(`Failed to add observations: ${errorMessage}`);
      // Or return an error part
    }
  },
});