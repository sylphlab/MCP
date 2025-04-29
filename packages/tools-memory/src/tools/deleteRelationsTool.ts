import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import { z } from 'zod'; // Keep value import as z.object is used
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
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
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Use memoryFilePath from options
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const deletedCount = await manager.deleteRelations(input.relations);
      // Output is a single number
      const validatedOutput = deleteRelationsToolOutputSchema.parse(deletedCount);
      // Wrap the number in a simple JSON structure for the output part
      return [jsonPart({ deletedCount: validatedOutput }, z.object({ deletedCount: deleteRelationsToolOutputSchema }))];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting relations.';
      throw new Error(`Failed to delete relations: ${errorMessage}`);
      // Or return an error part
    }
  },
});