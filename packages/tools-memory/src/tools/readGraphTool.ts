import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core'; // No ToolContext import needed
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions } from '../types'; // Import types
import {
  readGraphToolInputSchema,
  readGraphToolOutputSchema,
} from './readGraphTool.schema.js';

// Infer input type (empty object)
type ReadGraphInput = z.infer<typeof readGraphToolInputSchema>;

import { MemoryContextSchema, type MemoryContext } from '../types.js'; // Import schema and inferred type

// Generic parameters are now inferred from the definition object
export const readGraphTool = defineTool({
  name: 'read-graph',
  description: 'Read the entire knowledge graph.',
  inputSchema: readGraphToolInputSchema, // Empty schema
  contextSchema: MemoryContextSchema, // Add the context schema

  execute: async (
    // Context type is inferred from MemoryContextSchema
    { context }: { context: MemoryContext; args: ReadGraphInput } // Use destructuring, args unused
  ): Promise<Part[]> => {
    // context is destructured
    // Access options via context
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const graphData = await loadGraph(memoryFilePath);
      const validatedOutput = readGraphToolOutputSchema.parse(graphData);
      return [jsonPart(validatedOutput, readGraphToolOutputSchema)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error reading graph.';
      throw new Error(`Failed to read graph: ${errorMessage}`);
    }
  },
});