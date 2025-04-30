import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod'; // Keep z import if used elsewhere, otherwise remove
import { loadGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node } from '../types'; // Import the new Node type
import {
  listLabelsToolInputSchema,
  listLabelsToolOutputSchema, // Keep schema import for jsonPart
} from './listLabelsTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema (even if empty, for consistency)
// type ListLabelsInput = z.infer<typeof listLabelsToolInputSchema>; // Not needed if args is unused

export const listLabelsTool = defineTool({
  name: 'list_labels', // Use snake_case for tool name consistency
  description: 'Lists all unique node labels present in the knowledge graph.',
  inputSchema: listLabelsToolInputSchema,
  // outputSchema: listLabelsToolOutputSchema, // REMOVED: Not a valid property for defineTool
  contextSchema: MemoryContextSchema,

  execute: async (
    // Only destructure context as args is not used
    { context }: { context: MemoryContext }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const allLabels = currentGraph.nodes.flatMap((node: Node) => node.labels);
      const uniqueLabels = [...new Set(allLabels)]; // Get unique labels

      // Output validation happens implicitly via jsonPart if schema is provided
      // Return as a JSON part, referencing the output schema for potential type hints or future use
      return [jsonPart(uniqueLabels, listLabelsToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error listing labels.';
      // Throwing an error is generally better for tool execution failures
      throw new Error(`Failed to list labels: ${errorMessage}`);
    }
  },
});