import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Edge } from '../types'; // Import the new Edge type
import {
  listRelationTypesToolInputSchema,
  listRelationTypesToolOutputSchema, // Keep schema import for jsonPart
} from './listRelationTypesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

export const listRelationTypesTool = defineTool({
  name: 'list_relation_types', // Use snake_case
  description: 'Lists all unique edge (relation) types present in the knowledge graph.',
  inputSchema: listRelationTypesToolInputSchema,
  // No outputSchema property for defineTool
  contextSchema: MemoryContextSchema,

  execute: async (
    // Only destructure context as args is not used
    { context }: { context: MemoryContext }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const allRelationTypes = currentGraph.edges.map((edge: Edge) => edge.type);
      const uniqueRelationTypes = [...new Set(allRelationTypes)]; // Get unique types

      // Return as a JSON part, referencing the output schema
      return [jsonPart(uniqueRelationTypes, listRelationTypesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error listing relation types.';
      throw new Error(`Failed to list relation types: ${errorMessage}`);
    }
  },
});