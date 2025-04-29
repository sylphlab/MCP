import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
import {
  deleteEntitiesToolInputSchema,
  deleteEntitiesToolOutputSchema,
} from './deleteEntitiesTool.schema.js';

// Infer input type from schema
type DeleteEntitiesInput = z.infer<typeof deleteEntitiesToolInputSchema>;

export const deleteEntitiesTool = defineTool({
  name: 'deleteEntities',
  description: 'Delete multiple entities and their associated relations from the knowledge graph.',
  inputSchema: deleteEntitiesToolInputSchema,

  execute: async (
    input: DeleteEntitiesInput,
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Use memoryFilePath from options
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const deletedNames = await manager.deleteEntities(input.entityNames);
      // Output schema is just an array of strings, parsing might be optional but good for consistency
      const validatedOutput = deleteEntitiesToolOutputSchema.parse(deletedNames);
      return [jsonPart(validatedOutput, deleteEntitiesToolOutputSchema)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting entities.';
      throw new Error(`Failed to delete entities: ${errorMessage}`);
      // Or return an error part
    }
  },
});