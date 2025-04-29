import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils'; // Import helpers
import type { MemoryToolExecuteOptions } from '../types'; // Import types
import {
  readGraphToolInputSchema,
  readGraphToolOutputSchema,
} from './readGraphTool.schema.js';

// Infer input type (empty object)
type ReadGraphInput = z.infer<typeof readGraphToolInputSchema>;

export const readGraphTool = defineTool({
  name: 'read-graph',
  description: 'Read the entire knowledge graph.',
  inputSchema: readGraphToolInputSchema, // Empty schema

  execute: async (
    _input: ReadGraphInput,
    options: MemoryToolExecuteOptions,
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(options.workspaceRoot, options.memoryFilePath);

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