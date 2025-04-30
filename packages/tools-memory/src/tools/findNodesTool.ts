import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, Properties } from '../types'; // Import Node and Properties types
import {
  findNodesToolInputSchema,
  findNodesToolOutputSchema, // Keep schema import for jsonPart
} from './findNodesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';

// Infer input type from schema
type FindNodesInput = z.infer<typeof findNodesToolInputSchema>;

// Helper function to check if a value matches the query based on mode
function matches(value: unknown, query: string, mode: 'substring' | 'exact'): boolean {
  if (typeof value !== 'string') {
    // If properties can contain non-strings, convert them for searching or handle differently
    // For now, only match against string values in properties
    return false;
  }
  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  return mode === 'exact' ? lowerValue === lowerQuery : lowerValue.includes(lowerQuery);
}

// Helper function to search within properties object
function searchProperties(properties: Properties, query: string, mode: 'substring' | 'exact'): boolean {
  for (const key in properties) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      const value = properties[key];
      // Recursively search in nested objects or arrays if needed, or just check top-level string values
      if (typeof value === 'string' && matches(value, query, mode)) {
        return true;
      }
      // Add logic here to handle arrays or nested objects if PropertyValueSchema allows them
    }
  }
  return false;
}


export const findNodesTool = defineTool({
  name: 'find_nodes', // Use snake_case
  description: 'Finds nodes (entities) in the knowledge graph based on a query string, searching in specified fields (name, labels, properties, all) using substring or exact matching, with pagination.',
  inputSchema: findNodesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: FindNodesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);
    const { query, search_in = 'all', mode = 'substring', limit = 50, offset = 0 } = args;

    try {
      const currentGraph = await loadGraph(memoryFilePath);

      const filteredNodes = currentGraph.nodes.filter((node: Node) => {
        let nameMatch = false;
        let labelMatch = false;
        let propertiesMatch = false;

        // Determine if we need to check name based on search_in
        if (search_in === 'name' || search_in === 'all') {
          // Assuming 'name' property exists within node.properties
          const nodeName = node.properties?.name; // Adjust if name is not in properties
          if (nodeName && matches(nodeName, query, mode)) {
             nameMatch = true;
          }
        }

        // Determine if we need to check labels based on search_in
        if (search_in === 'labels' || search_in === 'all') {
          if (node.labels.some(label => matches(label, query, mode))) {
            labelMatch = true;
          }
        }

        // Determine if we need to check properties based on search_in
        if (search_in === 'properties' || search_in === 'all') {
          if (searchProperties(node.properties, query, mode)) {
            propertiesMatch = true;
          }
        }

        // Return based on the specific search_in or the combination for 'all'/default
        switch (search_in) {
          case 'name': return nameMatch;
          case 'labels': return labelMatch;
          case 'properties': return propertiesMatch;
          // case 'all': // REMOVED as default handles this
          default: return nameMatch || labelMatch || propertiesMatch;
        }
      });

      const totalCount = filteredNodes.length;
      const paginatedNodes = filteredNodes.slice(offset, offset + limit);

      const result = {
        nodes: paginatedNodes,
        totalCount: totalCount,
      };

      return [jsonPart(result, findNodesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error finding nodes.';
      throw new Error(`Failed to find nodes: ${errorMessage}`);
    }
  },
});