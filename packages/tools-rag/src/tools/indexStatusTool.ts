import path from 'node:path';
import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import type { IEmbeddingFunction } from 'chromadb';
import { z } from 'zod';
import { getRagCollection } from '../chroma.js';

// --- Input Schema ---
// Define Input Schema using Zod (optional, could be empty)
const IndexStatusInputSchema = z.object({}).optional(); // No input needed

// --- TypeScript Type ---
export type IndexStatusInput = z.infer<typeof IndexStatusInputSchema>;

// --- Output Types ---
export interface IndexStatusResult {
  /** Whether retrieving status was successful. */
  success: boolean;
  /** Number of items in the index collection. */
  count?: number;
  /** Name of the index collection. */
  collectionName?: string;
  /** Error message, if retrieval failed. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const IndexStatusResultSchema = z.object({
  success: z.boolean(),
  count: z.number().int().nonnegative().optional(),
  collectionName: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const IndexStatusOutputSchema = z.array(IndexStatusResultSchema);

// --- Tool Definition using defineTool ---
export const indexStatusTool = defineTool({
  name: 'getIndexStatus',
  description: 'Gets the status of the RAG index (e.g., number of items).',
  inputSchema: IndexStatusInputSchema,
  

  execute: async (
    _input: IndexStatusInput, // Input is optional/empty
    options: ToolExecuteOptions,
  ): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (though input is empty/optional)
    const parsed = IndexStatusInputSchema.safeParse(_input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(
          ([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : ''}`,
        )
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }

    // Add upfront check for workspaceRoot within options
    if (!options?.workspaceRoot) {
      throw new Error('Workspace root is not available in options.');
    }

    const results: IndexStatusResult[] = [];
    let count: number | undefined;
    let collectionName: string | undefined;
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      const chromaDbPath = path.join(options.workspaceRoot, '.mcp', 'chroma_db');

      // Create a minimal dummy embedding function locally
      // TODO: Refactor getRagCollection to not require embeddingFn for count()
      const dummyEmbeddingFn: IEmbeddingFunction = {
        generate: async (texts: string[]) => texts.map(() => []),
      };

      const collection = await getRagCollection(
        dummyEmbeddingFn,
        options.workspaceRoot,
        chromaDbPath,
      );
      count = await collection.count();
      collectionName = collection.name;
      success = true;
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown error getting index status';
      suggestion = 'Check ChromaDB setup, path, and connectivity.';
      count = undefined;
      collectionName = undefined;
    }

    // Push the single result
    results.push({
      success,
      count,
      collectionName,
      error,
      suggestion,
    });

    // Return the result wrapped in jsonPart
    return [jsonPart(results, IndexStatusOutputSchema)];
  },
});

// Export necessary types
