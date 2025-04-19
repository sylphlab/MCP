import { z } from 'zod';
import { McpTool, McpToolInput, BaseMcpToolOutput, McpContentPart } from '@sylphlab/mcp-core';
import { EmbeddingModelConfigSchema, generateEmbeddings, EmbeddingModelProvider, defaultEmbeddingConfig } from '../embedding.js'; // Import default config
import { IndexManager, VectorDbConfigSchema, QueryResult, VectorDbProvider } from '../indexManager.js'; // Add .js

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

  async execute(input: z.infer<typeof QueryIndexInputSchema>, context): Promise<BaseMcpToolOutput> { // Explicitly type input
    const { queryText, topK, filter, embeddingConfig, vectorDbConfig } = input;
    console.log(`queryIndexTool: Processing query "${queryText.substring(0, 50)}..."`);

    // 1. Generate embedding for the query text
    // TODO: Handle potential errors during embedding generation
    // Provide complete default mock config if none is given in input
    const currentEmbeddingConfig = embeddingConfig ?? defaultEmbeddingConfig; // Use exported default
    const queryEmbeddings = await generateEmbeddings([queryText], currentEmbeddingConfig);

    if (!queryEmbeddings || queryEmbeddings.length === 0) {
      // TODO: Return error output
      throw new Error('Failed to generate embedding for the query text.');
    }
    const queryVector = queryEmbeddings[0];
    console.log(`Generated query vector (dimension: ${queryVector.length}).`);

    // 2. Initialize IndexManager and query the index
    // Provide default config if none is given in input
    const currentIndexConfig = vectorDbConfig ?? { provider: VectorDbProvider.InMemory };
    // Use static create method for async initialization
    const indexManager = await IndexManager.create(currentIndexConfig);
    // TODO: Handle potential errors during query
    const results: QueryResult[] = await indexManager.queryIndex(queryVector, topK, filter);
    console.log(`Retrieved ${results.length} results from index.`);

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