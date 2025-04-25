import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import { VectorDbProvider } from '../indexManager.js'; // Import Provider only
import type { RagCoreToolExecuteOptions } from '../types.js'; // Import extended options type
import { getRagCollection } from '../chroma.js'; // Import lower-level function
import type { IEmbeddingFunction } from 'chromadb'; // Needed for dummy function

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

    // Assert options type to access ragConfig
    const ragOptions = options as RagCoreToolExecuteOptions;
    if (!ragOptions.ragConfig) {
      throw new Error('RAG configuration (ragConfig) is missing in ToolExecuteOptions.');
    }
    const { vectorDb: vectorDbConfig } = ragOptions.ragConfig;

    const results: IndexStatusResult[] = [];
    let count: number | undefined;
    let collectionName: string | undefined;
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      // Use getRagCollection directly for status as a workaround, using config from options
      if (vectorDbConfig.provider !== VectorDbProvider.ChromaDB) {
        success = false;
        error = `getIndexStatus currently only supports ChromaDB via getRagCollection. Provider: ${vectorDbConfig.provider}`;
        suggestion = 'Use a ChromaDB configuration or implement status retrieval for other providers.';
        // Try to get name if possible
        if (vectorDbConfig.provider === VectorDbProvider.Pinecone) {
            collectionName = vectorDbConfig.indexName;
        } else {
            collectionName = 'N/A (Non-ChromaDB)';
        }
        count = undefined;
      } else {
        // Proceed with ChromaDB logic using getRagCollection

        // Create a dummy embedding function as getRagCollection requires one
        const dummyEmbeddingFn: IEmbeddingFunction = {
          generate: async (texts: string[]) => texts.map(() => []),
        };

        // Use host URL if provided, otherwise local path
        const clientPath = vectorDbConfig.host || vectorDbConfig.path;
        if (!clientPath) {
          throw new Error('ChromaDB configuration requires either a "path" or a "host".');
        }

        // Ensure collectionName is defined for ChromaDB
        if (!vectorDbConfig.collectionName) {
            throw new Error('ChromaDB configuration requires a "collectionName".');
        }

        // Call getRagCollection with details from vectorDbConfig
        // Note: workspaceRoot is no longer passed as path/host should be absolute/resolvable
        const collection = await getRagCollection(
            dummyEmbeddingFn,
            clientPath, // Pass URL or path
            vectorDbConfig.collectionName // Pass collectionName from config
        );

        count = await collection.count();
        collectionName = collection.name; // Get name directly from collection object
        success = true;
      }
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown error getting index status';
      suggestion = 'Check vector database configuration and connectivity.';
      count = undefined;
      // Try to get collection name from config even on error, if possible
      if (vectorDbConfig.provider === VectorDbProvider.ChromaDB && vectorDbConfig.collectionName) {
          collectionName = vectorDbConfig.collectionName;
      } else if (vectorDbConfig.provider === VectorDbProvider.Pinecone && vectorDbConfig.indexName) {
          collectionName = vectorDbConfig.indexName;
      } else {
          collectionName = undefined;
      }
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
