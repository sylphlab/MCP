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

// Helper function to check if a value matches the query based on mode (Simplified)
function matches(value: unknown, query: string, mode: 'substring' | 'exact'): boolean {
  // console.log(`  [matches] Input: value="${value}", query="${query}", mode="${mode}"`);
  if (typeof value !== 'string') {
    // console.log("  [matches] Result: false (value is not a string)");
    return false;
  }
  const lowerQuery = query.toLowerCase();
  const lowerValue = value.toLowerCase();
  // console.log(`  [matches] Lower: lowerValue="${lowerValue}", lowerQuery="${lowerQuery}"`);
  let result: boolean;
  if (mode === 'exact') {
    result = lowerValue === lowerQuery;
  } else {
    const includesResult = lowerValue.includes(lowerQuery);
    // console.log(`  [matches] lowerValue.includes(lowerQuery) result: ${includesResult}`);
    result = includesResult;
  }
  // console.log(`  [matches] Final Result: ${result}`);
  return result;
}

// Helper function to search within properties object
function searchProperties(properties: Properties, query: string, mode: 'substring' | 'exact'): boolean {
  for (const key in properties) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      const value = properties[key];
      if (typeof value === 'string' && matches(value, query, mode)) {
        return true;
      }
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
        // console.log(`Checking node: ${node.id}, Labels: ${node.labels.join(',')}, Props: ${JSON.stringify(node.properties)} for query: "${query}", search_in: ${search_in}, mode: ${mode}`);
        // console.log(`  Node ${node.id} labels:`, node.labels);

        if (search_in === 'name') {
            const nodeName = node.properties?.name;
            const keep = !!nodeName && matches(nodeName, query, mode);
            // console.log(`  -> Keep (name only): ${keep}`);
            return keep;
        }
        if (search_in === 'labels') {
            let keep = false;
            for (const label of node.labels) {
                const isMatch = matches(label, query, mode);
                // console.log(`    Label: "${label}", Query: "${query}", Mode: ${mode}, Match: ${isMatch}`);
                if (isMatch) {
                    keep = true;
                    break;
                }
            }
            // console.log(`  -> Keep (labels only): ${keep}`);
            return keep;
        }
        if (search_in === 'properties') {
            const keep = searchProperties(node.properties, query, mode);
            // console.log(`  -> Keep (properties only): ${keep}`);
            return keep;
        }

        // Default: search_in === 'all'
        const nameMatch = !!node.properties?.name && matches(node.properties.name, query, mode);
        let labelMatch = false;
        for (const label of node.labels) {
             const isMatch = matches(label, query, mode);
             // console.log(`    [all] Label: "${label}", Query: "${query}", Mode: ${mode}, Match: ${isMatch}`);
            if (isMatch) {
                labelMatch = true;
                break;
            }
        }
        const propertiesMatch = searchProperties(node.properties, query, mode);
        const keep = nameMatch || labelMatch || propertiesMatch;
        // console.log(`  -> NameMatch: ${nameMatch}, LabelMatch: ${labelMatch}, PropsMatch: ${propertiesMatch}, Keep (all): ${keep}`);
        return keep;
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