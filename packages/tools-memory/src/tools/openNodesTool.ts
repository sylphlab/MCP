import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
import {
  openNodesToolInputSchema,
  openNodesToolOutputSchema,
} from './openNodesTool.schema.js';

// Infer input type from schema
type OpenNodesInput = z.infer<typeof openNodesToolInputSchema>;

export const openNodesTool = defineTool({
  name: 'openNodes',
  description: 'Retrieve specific entities and their direct relations from the knowledge graph by name.',
  inputSchema: openNodesToolInputSchema,

  execute: async (
    input: OpenNodesInput,
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Use memoryFilePath from options
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const openResults = await manager.openNodes(input.names);
      const validatedOutput = openNodesToolOutputSchema.parse(openResults);
      return [jsonPart(validatedOutput, openNodesToolOutputSchema)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error opening nodes.';
      throw new Error(`Failed to open nodes: ${errorMessage}`);
      // Or return an error part
    }
  },
});