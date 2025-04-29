import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core'; // No ToolContext import needed
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions, KnowledgeGraph, Relation } from '../types'; // Import types
import {
  createRelationsToolInputSchema,
  createRelationsToolOutputSchema,
} from './createRelationsTool.schema.js';

// Infer input type from schema
type CreateRelationsInput = z.infer<typeof createRelationsToolInputSchema>;

import { MemoryContextSchema, type MemoryContext } from '../types.js'; // Import schema and inferred type

// Generic parameters are now inferred from the definition object
export const createRelationsTool = defineTool({
  name: 'create-relations',
  description: 'Create multiple new relations between entities in the knowledge graph. Relations should be in active voice.',
  inputSchema: createRelationsToolInputSchema,
  contextSchema: MemoryContextSchema, // Add the context schema

  execute: async (
    // Context type is inferred from MemoryContextSchema
    { context, args }: { context: MemoryContext; args: CreateRelationsInput } // Use destructuring
  ): Promise<Part[]> => {
    // context and args are destructured
    // Access options via context
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const existingRelationSet = new Set(currentGraph.relations.map(r => `${r.from}|${r.to}|${r.relationType}`));
      const newRelations: Relation[] = [];

      // Access input via args
      for (const relationInput of args.relations) {
        const relationKey = `${relationInput.from}|${relationInput.to}|${relationInput.relationType}`;
        if (!existingRelationSet.has(relationKey)) {
          newRelations.push(relationInput);
          existingRelationSet.add(relationKey);
        }
      }

      if (newRelations.length > 0) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph,
          relations: [...currentGraph.relations, ...newRelations], // Create new array
        };
        await saveGraph(memoryFilePath, nextGraph);
      }

      const validatedOutput = createRelationsToolOutputSchema.parse(newRelations);
      return [jsonPart(validatedOutput, createRelationsToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during relation creation.';
      throw new Error(`Failed to create relations: ${errorMessage}`);
    }
  },
});