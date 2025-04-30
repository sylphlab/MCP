import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node } from '../types'; // Import the new Node type
import {
  getNodeToolInputSchema,
  getNodeToolOutputSchema, // Keep schema import for jsonPart
} from './getNodeTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type GetNodeInput = z.infer<typeof getNodeToolInputSchema>;

export const getNodeTool = defineTool({
  name: 'get_node', // Use snake_case
  description: 'Retrieves a specific node (entity) from the knowledge graph by its exact ID (UUID).',
  inputSchema: getNodeToolInputSchema,
  // No outputSchema property for defineTool
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: GetNodeInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const foundNode = currentGraph.nodes.find((node: Node) => node.id === args.id);

      // Return the found node (or null if not found) as a JSON part
      // The output schema allows null
      return [jsonPart(foundNode ?? null, getNodeToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error getting node.';
      throw new Error(`Failed to get node with ID ${args.id}: ${errorMessage}`);
    }
  },
});