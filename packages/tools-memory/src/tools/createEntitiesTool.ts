import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core'; // Keep Part
import type { z } from 'zod'; // Use type import for Zod value
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
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
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Input validation is implicitly handled by the structure before execution,
    // but defineTool could potentially add runtime checks if needed.

    // Use memoryFilePath from options, fallback handled within manager constructor
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const createdEntities = await manager.createEntities(input.entities);

      // Validate output against schema before returning (good practice)
      const validatedOutput = createEntitiesToolOutputSchema.parse(createdEntities);

      return [jsonPart(validatedOutput, createEntitiesToolOutputSchema)];
    } catch (error: unknown) {
      // Handle errors from the manager (e.g., file system errors)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during entity creation.';
      // Consider creating a specific error part type or using textPart
      // For now, re-throwing might be handled by the adaptor/server runner
      throw new Error(`Failed to create entities: ${errorMessage}`);
      // Or return an error part:
      // return [textPart(`Error: Failed to create entities - ${errorMessage}`)];
    }
  },
});