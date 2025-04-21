import { z } from 'zod';
// Remove incorrect McpToolContext import
import { type McpTool, McpToolInput, type BaseMcpToolOutput, type McpContentPart, type McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Added McpToolExecuteOptions
import {
  EmbeddingModelConfigSchema,
  generateEmbeddings,
    EmbeddingModelProvider,
    defaultEmbeddingConfig,
    OllamaEmbeddingFunction, // Import class
    HttpEmbeddingFunction,   // Import class
    MockEmbeddingFunction    // Import class
} from '../embedding.js'; // Import default config and classes
import { IndexManager, VectorDbConfigSchema, type QueryResult, VectorDbProvider } from '../indexManager.js'; // Add .js

// Define the input schema for the queryIndexTool
export const QueryIndexInputSchema = z.object({
  queryText: z.string(),
  topK: z.number().int().positive().default(5),
  // Filter values must be primitive for ChromaDB compatibility
  filter: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  embeddingConfig: EmbeddingModelConfigSchema.optional(),
  vectorDbConfig: VectorDbConfigSchema.optional(),
});

// Output schema is implicitly BaseMcpToolOutput, content will contain results

export const queryIndexTool: McpTool<typeof QueryIndexInputSchema, BaseMcpToolOutput> = {
  name: 'queryIndex',
  description: 'Embeds a query text and searches the index for similar content.',
  inputSchema: QueryIndexInputSchema,

  // Correct signature based on type error: second param is workspaceRoot: string
  async execute(input: z.infer<typeof QueryIndexInputSchema>, options: McpToolExecuteOptions): Promise<BaseMcpToolOutput> { // Remove workspaceRoot, require options
    const { queryText, topK, filter, embeddingConfig, vectorDbConfig } = input;
    // workspaceRoot is now in options.workspaceRoot if needed
    console.log(`queryIndexTool: Processing query "${queryText.substring(0, 50)}..."`);

    // 1. Generate embedding for the query text
    let queryVector: number[];
    // Define currentEmbeddingConfig here so it's accessible later
    const currentEmbeddingConfig = embeddingConfig ?? defaultEmbeddingConfig; // Use exported default
    try {
        const queryEmbeddings = await generateEmbeddings([queryText], currentEmbeddingConfig);

        if (!queryEmbeddings || queryEmbeddings.length === 0) {
            // This case should ideally be handled within generateEmbeddings or its underlying functions
            throw new Error('Embedding generation returned no results.');
        }
        queryVector = queryEmbeddings[0];
        console.log(`Generated query vector (dimension: ${queryVector.length}).`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error generating query embedding: ${errorMessage}`);
        return {
            success: false,
            content: [{ type: 'text', text: `Error generating query embedding: ${errorMessage}` }],
        };
    }

    // 2. Initialize IndexManager and query the index
    // Provide default config if none is given in input
    const currentIndexConfig = vectorDbConfig ?? { provider: VectorDbProvider.InMemory };
    let results: QueryResult[];
    try {
        // Use static create method for async initialization
        // Pass embedding function if needed (e.g., for ChromaDB initialization)
        const embeddingFnInstance = currentEmbeddingConfig.provider === EmbeddingModelProvider.Ollama
            ? new OllamaEmbeddingFunction(currentEmbeddingConfig.modelName, currentEmbeddingConfig.baseURL)
            : currentEmbeddingConfig.provider === EmbeddingModelProvider.Http
            ? new HttpEmbeddingFunction(currentEmbeddingConfig.url, currentEmbeddingConfig.headers, currentEmbeddingConfig.batchSize)
            : new MockEmbeddingFunction(currentEmbeddingConfig.mockDimension); // Default to Mock

        const indexManager = await IndexManager.create(currentIndexConfig, embeddingFnInstance);
        results = await indexManager.queryIndex(queryVector, topK, filter);
        console.log(`Retrieved ${results.length} results from index.`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error querying index: ${errorMessage}`);
        return {
            success: false,
            content: [{ type: 'text', text: `Error querying index: ${errorMessage}` }],
        };
    }

    // 3. Format the results
    let outputContent: McpContentPart[];
    if (results.length === 0) {
       outputContent = [{ type: 'text', text: 'No relevant results found in the index.' }];
    } else {
       // Create a summary text part and potentially structured parts later
       outputContent = [{
          type: 'text',
          text: `Found ${results.length} relevant results (showing top ${Math.min(results.length, topK)}):`
       }];
       // Add individual results as separate text parts (or structured data)
       results.forEach((result, index) => {
          outputContent.push({
             type: 'text',
             text: `\n--- Result ${index + 1} (Score: ${result.score.toFixed(4)}) ---\nSource: ${result.item.metadata?.source || 'unknown'}\nLanguage: ${result.item.metadata?.language || 'unknown'}\nContent:\n${result.item.content}`
          });
       });
    }

    // Include raw results in a data field for programmatic access
    const outputData = {
       query: queryText,
       results: results, // Array of QueryResult objects
    };

    return {
      success: true,
      content: outputContent,
      data: outputData, // Add structured results data
    };
  },
};