import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Add ToolExecuteOptions import
import { z } from 'zod';
import {
  // EmbeddingModelConfigSchema, // No longer needed in input
  EmbeddingModelProvider,
  HttpEmbeddingFunction,
  MockEmbeddingFunction,
  OllamaEmbeddingFunction,
  // defaultEmbeddingConfig, // Config comes from options
  generateEmbeddings,
} from '../embedding.js';
import {
  IndexManager,
  type QueryResult, // Keep QueryResult type
  // VectorDbConfigSchema, // No longer needed in input
  VectorDbProvider,
} from '../indexManager.js';
import type { RagToolExecuteOptions } from '../types.js'; // Use the new shared options type

// --- Input Schema ---
// Remove embeddingConfig and vectorDbConfig
export const QueryIndexInputSchema = z.object({
  queryText: z.string(),
  topK: z.number().int().positive().default(5),
  filter: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// --- TypeScript Types ---
export type QueryIndexInput = z.infer<typeof QueryIndexInputSchema>;

// --- Output Types ---
export interface QueryIndexResult {
  /** Whether the query operation was successful. */
  success: boolean;
  /** The original query text. */
  query: string;
  /** Array of query results. */
  results: QueryResult[];
  /** Error message, if the operation failed. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the result
const QueryResultSchema = z.object({
  item: z.object({
    id: z.string(),
    content: z.string(),
    vector: z.array(z.number()).optional(),
    metadata: z.record(z.any()).optional(),
  }),
  score: z.number(),
});

const QueryIndexResultSchema = z.object({
  success: z.boolean(),
  query: z.string(),
  results: z.array(QueryResultSchema),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const QueryIndexOutputSchema = z.array(QueryIndexResultSchema);

// --- Tool Definition using defineTool ---
export const queryIndexTool = defineTool({
  name: 'queryIndex',
  description: 'Embeds a query text and searches the index for similar content.',
  inputSchema: QueryIndexInputSchema,


  execute: async (input: QueryIndexInput, options: ToolExecuteOptions): Promise<Part[]> => { // Keep base type
    // Zod validation
    const parsed = QueryIndexInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { queryText, topK, filter } = parsed.data;

    // Assert options type to access indexManager and ragConfig
    const ragOptions = options as RagToolExecuteOptions;
    if (!ragOptions.indexManager || !ragOptions.ragConfig) {
      throw new Error('IndexManager instance or RagConfig is missing in ToolExecuteOptions.');
    }
    // Check if the manager instance itself is initialized
    if (!ragOptions.indexManager.isInitialized()) {
        throw new Error('IndexManager is not initialized. Cannot query index.');
    }
    const indexManager = ragOptions.indexManager;
    const { embedding: embeddingConfig } = ragOptions.ragConfig; // Get embedding config

    const resultsContainer: QueryIndexResult[] = [];
    let queryResults: QueryResult[] = [];
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      // 1. Generate embedding for the query text using config from options
      let queryVector: number[];
      try {
        const queryEmbeddings = await generateEmbeddings([queryText], embeddingConfig);
        if (!queryEmbeddings || queryEmbeddings.length === 0 || !queryEmbeddings[0]) {
          throw new Error('Embedding generation returned no results or invalid data.');
        }
        queryVector = queryEmbeddings[0];
      } catch (embeddingError) {
        const errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
        throw new Error(`Error generating query embedding: ${errorMessage}`);
      }

      // 2. Query the index using the indexManager instance from options
      try {
        queryResults = await indexManager.queryIndex(queryVector, topK, filter);
        success = true;
      } catch (queryError) {
        const errorMessage = queryError instanceof Error ? queryError.message : String(queryError);
        throw new Error(`Error querying index: ${errorMessage}`);
      }
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown error during query processing';
      if (error.includes('embedding')) {
        suggestion = 'Check embedding model configuration and API key/endpoint validity.';
      } else if (error.includes('index') || error.includes('querying')) {
        suggestion = 'Check vector database configuration, connectivity, and query filter syntax.';
      } else {
        suggestion = 'An unexpected error occurred during query processing.';
      }
      queryResults = []; // Ensure results are empty on error
    }

    // Push the single result object
    resultsContainer.push({
      success,
      query: queryText,
      results: queryResults,
      error,
      suggestion,
    });

    // Return the result wrapped in jsonPart
    return [jsonPart(resultsContainer, QueryIndexOutputSchema)];
  },
});

// Export necessary types
