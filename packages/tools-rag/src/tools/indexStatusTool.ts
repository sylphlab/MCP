import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import type { IndexManager } from '../indexManager.js';
import type { RagToolExecuteOptions } from '../types.js'; // Import the shared extended options type

// --- Input Schema ---
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
    options: ToolExecuteOptions, // Keep base type for compatibility
  ): Promise<Part[]> => {
    // Zod validation
    const parsed = IndexStatusInputSchema.safeParse(_input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(
          ([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : ''}`,
        )
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }

    // Assert options type to access indexManager using the shared type
    const ragOptions = options as RagToolExecuteOptions;
    if (!ragOptions.indexManager) {
      throw new Error('IndexManager instance is missing in ToolExecuteOptions.');
    }
    // Check if the manager instance itself is initialized
    if (!ragOptions.indexManager.isInitialized()) {
        throw new Error('IndexManager is not initialized. Cannot get status.');
    }
    const indexManager = ragOptions.indexManager;

    const results: IndexStatusResult[] = [];
    let count: number | undefined;
    let collectionName: string | undefined;
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      // Call the getStatus method on the provided IndexManager instance
      const status = await indexManager.getStatus();
      count = status.count;
      collectionName = status.name;
      success = true;
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown error getting index status';
      suggestion = 'Check vector database configuration and connectivity, or IndexManager initialization.';
      count = undefined;
      collectionName = undefined; // Reset on error
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
