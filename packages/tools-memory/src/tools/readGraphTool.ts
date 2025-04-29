import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
import {
  readGraphToolInputSchema,
  readGraphToolOutputSchema,
} from './readGraphTool.schema.js';

// Infer input type (empty object)
type ReadGraphInput = z.infer<typeof readGraphToolInputSchema>;

export const readGraphTool = defineTool({
  name: 'readGraph',
  description: 'Read the entire knowledge graph.',
  inputSchema: readGraphToolInputSchema, // Empty schema

  execute: async (
    _input: ReadGraphInput, // Mark input as unused
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Use memoryFilePath from options
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const graphData = await manager.readGraph();
      const validatedOutput = readGraphToolOutputSchema.parse(graphData);
      return [jsonPart(validatedOutput, readGraphToolOutputSchema)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error reading graph.';
      throw new Error(`Failed to read graph: ${errorMessage}`);
      // Or return an error part
    }
  },
});