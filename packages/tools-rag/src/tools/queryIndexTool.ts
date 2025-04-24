import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Add ToolExecuteOptions import
import { z } from 'zod';
import {
  EmbeddingModelConfigSchema,
  EmbeddingModelProvider,
  HttpEmbeddingFunction,
  MockEmbeddingFunction,
  OllamaEmbeddingFunction,
  defaultEmbeddingConfig,
  generateEmbeddings,
} from '../embedding.js';
import {
  IndexManager,
  type QueryResult, // Keep QueryResult type
  VectorDbConfigSchema,
  VectorDbProvider,
} from '../indexManager.js';
import type { RagCoreToolExecuteOptions } from '../types.js'; // Import extended options type

// --- Input Schema ---
export const QueryIndexInputSchema = z.object({
  queryText: z.string(),
  topK: z.number().int().positive().default(5),
  filter: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  // embeddingConfig and vectorDbConfig removed - will come from options
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
// Note: QueryResult contains complex data (metadata object), use z.custom or refine
const QueryResultSchema = z.object({
  item: z.object({
    id: z.string(),
    content: z.string(),
    vector: z.array(z.number()).optional(), // Vector might not always be returned
    metadata: z.record(z.any()).optional(), // Metadata can be complex
  }),
  score: z.number(),
});

const QueryIndexResultSchema = z.object({
  success: z.boolean(),
  query: z.string(),
  results: z.array(QueryResultSchema), // Use the defined schema
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
  

  execute: async (input: QueryIndexInput, options: ToolExecuteOptions): Promise<Part[]> => { // Keep base type for compatibility
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = QueryIndexInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { queryText, topK, filter } = parsed.data; // Remove config from input destructuring

    const resultsContainer: QueryIndexResult[] = []; // Array to hold the single result object
    let queryResults: QueryResult[] = [];
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      // Assert options type to access ragConfig
      const ragOptions = options as RagCoreToolExecuteOptions;
      if (!ragOptions.ragConfig) {
        throw new Error('RAG configuration (ragConfig) is missing in ToolExecuteOptions.');
      }
      const { vectorDb: vectorDbConfig, embedding: embeddingConfig } = ragOptions.ragConfig;

      // 1. Generate embedding for the query text
      let queryVector: number[];
      // Use embeddingConfig directly from options.ragConfig
      const currentEmbeddingConfig = embeddingConfig; // No need for ?? default
      try {
        const queryEmbeddings = await generateEmbeddings([queryText], currentEmbeddingConfig);
        if (!queryEmbeddings || queryEmbeddings.length === 0 || !queryEmbeddings[0]) {
          throw new Error('Embedding generation returned no results or invalid data.');
        }
        queryVector = queryEmbeddings[0];
      } catch (embeddingError) {
        const errorMessage =
          embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
        throw new Error(`Error generating query embedding: ${errorMessage}`); // Re-throw for main catch
      }

      // 2. Initialize IndexManager and query the index
      // Use vectorDbConfig directly from options.ragConfig
      const currentIndexConfig = vectorDbConfig; // No need for ?? default
      try {
        const embeddingFnInstance =
          currentEmbeddingConfig.provider === EmbeddingModelProvider.Ollama
            ? new OllamaEmbeddingFunction(
                currentEmbeddingConfig.modelName,
                currentEmbeddingConfig.baseURL,
              )
            : currentEmbeddingConfig.provider === EmbeddingModelProvider.Http
              ? new HttpEmbeddingFunction(
                  currentEmbeddingConfig.url,
                  currentEmbeddingConfig.headers,
                  currentEmbeddingConfig.batchSize,
                )
              : new MockEmbeddingFunction(currentEmbeddingConfig.mockDimension);

        const indexManager = await IndexManager.create(currentIndexConfig, embeddingFnInstance);
        queryResults = await indexManager.queryIndex(queryVector, topK, filter);
        success = true;
      } catch (queryError) {
        const errorMessage = queryError instanceof Error ? queryError.message : String(queryError);
        throw new Error(`Error querying index: ${errorMessage}`); // Re-throw for main catch
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
