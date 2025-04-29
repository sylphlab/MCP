import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
import {
  deleteObservationsToolInputSchema,
  deleteObservationsToolOutputSchema,
} from './deleteObservationsTool.schema.js';

// Infer input type from schema
type DeleteObservationsInput = z.infer<typeof deleteObservationsToolInputSchema>;

export const deleteObservationsTool = defineTool({
  name: 'deleteObservations',
  description: 'Delete specific observations from entities in the knowledge graph.',
  inputSchema: deleteObservationsToolInputSchema,

  execute: async (
    input: DeleteObservationsInput,
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Use memoryFilePath from options
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const deletedResults = await manager.deleteObservations(input.deletions);
      const validatedOutput = deleteObservationsToolOutputSchema.parse(deletedResults);
      return [jsonPart(validatedOutput, deleteObservationsToolOutputSchema)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting observations.';
      throw new Error(`Failed to delete observations: ${errorMessage}`);
      // Or return an error part
    }
  },
});