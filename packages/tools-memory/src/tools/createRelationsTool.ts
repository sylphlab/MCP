import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core'; // Keep Part
import type { z } from 'zod'; // Use type import as suggested by Biome
import { KnowledgeGraphManager } from '../knowledgeGraphManager'; // Remove .js extension
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
import {
  createRelationsToolInputSchema,
  createRelationsToolOutputSchema,
} from './createRelationsTool.schema.js';

// Infer input type from schema
type CreateRelationsInput = z.infer<typeof createRelationsToolInputSchema>;

export const createRelationsTool = defineTool({
  name: 'createRelations',
  description: 'Create multiple new relations between entities in the knowledge graph. Relations should be in active voice.',
  inputSchema: createRelationsToolInputSchema,

  execute: async (
    input: CreateRelationsInput,
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Use memoryFilePath from options
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const createdRelations = await manager.createRelations(input.relations);
      const validatedOutput = createRelationsToolOutputSchema.parse(createdRelations);
      return [jsonPart(validatedOutput, createRelationsToolOutputSchema)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during relation creation.';
      throw new Error(`Failed to create relations: ${errorMessage}`);
      // Or return an error part
    }
  },
});