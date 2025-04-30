import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { Part } from '@sylphlab/tools-core';
import type { z } from 'zod';
import { loadGraph, saveGraph, resolveMemoryFilePath } from '../graphUtils';
import type { Node, KnowledgeGraph } from '../types'; // Import Node and KnowledgeGraph types
import {
  createNodesToolInputSchema,
  createNodesToolOutputSchema,
} from './createNodesTool.schema.js';
import { MemoryContextSchema, type MemoryContext } from '../types.js';
import crypto from 'node:crypto'; // Import crypto for UUID generation

// Infer input type from schema
type CreateNodesInput = z.infer<typeof createNodesToolInputSchema>;
// Define the input structure for a single node more explicitly
type NodeInput = CreateNodesInput['nodes'][number] & { id?: string }; // Allow optional ID in input type

export const createNodesTool = defineTool({
  name: 'create_nodes', // New tool name
  description: 'Create multiple new nodes (entities) with labels and properties in the knowledge graph.',
  inputSchema: createNodesToolInputSchema,
  contextSchema: MemoryContextSchema,

  execute: async (
    { context, args }: { context: MemoryContext; args: CreateNodesInput }
  ): Promise<Part[]> => {
    const memoryFilePath = resolveMemoryFilePath(context.workspaceRoot, context.memoryFilePath);

    try {
      const currentGraph = await loadGraph(memoryFilePath);
      const newNodes: Node[] = [];
      const existingIds = new Set(currentGraph.nodes.map(n => n.id));

      // First pass: Validate all incoming IDs and generate missing ones
      const nodesToCreate: Node[] = [];
      for (const nodeInput of args.nodes as NodeInput[]) { // Cast to allow checking for id
        let nodeId: string;
        if (nodeInput.id) {
          // Check for ID collision BEFORE proceeding
          if (existingIds.has(nodeInput.id)) {
            throw new Error(`Node with provided ID '${nodeInput.id}' already exists.`);
          }
          // Also check for duplicates within the current batch request
          if (nodesToCreate.some(n => n.id === nodeInput.id)) {
             throw new Error(`Duplicate ID '${nodeInput.id}' provided in the same request.`);
          }
          nodeId = nodeInput.id;
        } else {
          // Generate a unique UUID if ID is not provided
          do {
            nodeId = crypto.randomUUID();
          } while (existingIds.has(nodeId) || nodesToCreate.some(n => n.id === nodeId));
        }

        nodesToCreate.push({
          id: nodeId,
          labels: nodeInput.labels,
          properties: nodeInput.properties,
        });
        // Add ID to existingIds immediately to catch duplicates in the same batch
        existingIds.add(nodeId);
      }

      // If validation passed for all inputs, proceed to save
      if (nodesToCreate.length > 0) {
        const nextGraph: KnowledgeGraph = {
          ...currentGraph,
          nodes: [...currentGraph.nodes, ...nodesToCreate], // Add new nodes
        };
        await saveGraph(memoryFilePath, nextGraph);
        newNodes.push(...nodesToCreate); // Add successfully processed nodes to the output list
      }

      // Validate output against schema before returning
      const validatedOutput = createNodesToolOutputSchema.parse(newNodes);
      return [jsonPart(validatedOutput, createNodesToolOutputSchema)];

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during node creation.';
      throw new Error(`Failed to create nodes: ${errorMessage}`);
    }
  },
});