import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import type { MemoryToolExecuteOptions } from '../types.js'; // Import extended options type
import {
  searchNodesToolInputSchema,
  searchNodesToolOutputSchema,
} from './searchNodesTool.schema.js';

// Infer input type from schema
type SearchNodesInput = z.infer<typeof searchNodesToolInputSchema>;

export const searchNodesTool = defineTool({
  name: 'searchNodes',
  description: 'Search for nodes (entities and relations) in the knowledge graph based on a query.',
  inputSchema: searchNodesToolInputSchema,

  execute: async (
    input: SearchNodesInput,
    options: MemoryToolExecuteOptions, // Use extended options type
  ): Promise<Part[]> => {
    // Use memoryFilePath from options
    const manager = new KnowledgeGraphManager(options.workspaceRoot, options.memoryFilePath);

    try {
      const searchResults = await manager.searchNodes(input.query);
      const validatedOutput = searchNodesToolOutputSchema.parse(searchResults);
      return [jsonPart(validatedOutput, searchNodesToolOutputSchema)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error searching nodes.';
      throw new Error(`Failed to search nodes: ${errorMessage}`);
      // Or return an error part
    }
  },
});