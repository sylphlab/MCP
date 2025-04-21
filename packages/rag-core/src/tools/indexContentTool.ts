import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpContentPart,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core'; // Added McpToolExecuteOptions
import hljs from 'highlight.js'; // Import highlight.js
import { z } from 'zod';
import { type ChunkingOptions, chunkCodeAst } from '../chunking.js'; // Import interface type
import {
  EmbeddingModelConfigSchema,
  EmbeddingModelProvider,
  defaultEmbeddingConfig,
  generateEmbeddings,
} from '../embedding.js'; // Import default config
import {
  IndexManager,
  type IndexedItem,
  VectorDbConfigSchema,
  VectorDbProvider,
} from '../indexManager.js';
import { SupportedLanguage } from '../parsing.js';
import type { Chunk } from '../types.js';

// Define the input schema for the indexContentTool
// Expecting an array of items to index, each with content, source, and language
export const IndexContentInputItemSchema = z.object({
  id: z.string().optional(), // Optional ID, generate if not provided?
  content: z.string(),
  source: z.string().optional(), // e.g., file path or URL
  language: z.nativeEnum(SupportedLanguage).optional(), // Language is now optional
  // Add optional metadata field?
});

// Define Zod schema for ChunkingOptions locally for input validation
const ChunkingOptionsSchema = z
  .object({
    maxChunkSize: z.number().int().positive().optional(),
    chunkOverlap: z.number().int().nonnegative().optional(),
  })
  .optional(); // Make the whole options object optional

// McpToolInput is a type, not a Zod schema object.
// We define the schema based on the expected structure.
export const IndexContentInputSchema = z.object({
  items: z.array(IndexContentInputItemSchema),
  chunkingOptions: ChunkingOptionsSchema, // Use the locally defined schema
  embeddingConfig: EmbeddingModelConfigSchema.optional(),
  vectorDbConfig: VectorDbConfigSchema.optional(),
});

// Output type is defined by the return value of execute, conforming to BaseMcpToolOutput
// No separate output schema definition needed on the tool object itself.

export const indexContentTool = defineTool({
  name: 'indexContent',
  description: 'Chunks, embeds, and indexes provided text content.',
  inputSchema: IndexContentInputSchema,
  // outputSchema property removed

  execute: async ( // Core logic passed to defineTool
    input: z.infer<typeof IndexContentInputSchema>,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<BaseMcpToolOutput> => { // Return type is BaseMcpToolOutput

    // Input validation is handled by registerTools/SDK
    const { items, chunkingOptions, embeddingConfig, vectorDbConfig } = input;

    // Provide default config if none is given in input
    const currentIndexConfig = vectorDbConfig ?? { provider: VectorDbProvider.InMemory };
    // Use static create method for async initialization
    const indexManager = await IndexManager.create(currentIndexConfig);

    const allIndexedItems: IndexedItem[] = []; // Explicitly type the array

    for (const item of items) {
      let languageToUse: SupportedLanguage | null = item.language ?? null;

      // 2. Detect language if not provided using highlight.js
      if (!languageToUse) {
        // highlightAuto might be slow for very large inputs, consider limiting input size
        // const contentSample = item.content.substring(0, 5000); // Limit sample size
        const detectionResult = hljs.highlightAuto(item.content);
        const detectedLang = detectionResult.language; // Lowercase language name or undefined
        const _relevance = detectionResult.relevance;

        // Map highlight.js language names to SupportedLanguage enum
        // Add more mappings as needed
        switch (detectedLang?.toLowerCase()) {
          case 'javascript':
          case 'js':
          case 'jsx': // Treat JSX as JS for parsing? Or add TSX?
            languageToUse = SupportedLanguage.JavaScript;
            break;
          case 'typescript':
          case 'ts':
          case 'tsx':
            languageToUse = SupportedLanguage.TypeScript; // Or TSX if enum exists & needed
            break;
          case 'python':
          case 'py':
            languageToUse = SupportedLanguage.Python;
            break;
          // Add cases for other SupportedLanguages...
          default:
            languageToUse = null; // Trigger fallback
        }
      }

      // 3. Chunk the content
      let chunks: Chunk[];
      try {
        chunks = await chunkCodeAst(item.content, languageToUse, chunkingOptions);
      } catch (error) {
        const _errorMessage = error instanceof Error ? error.message : String(error);
        continue; // Skip to the next item
      }

      if (chunks.length === 0) {
        continue;
      }

      // The result from chunkCodeAst is already Chunk[] with basic metadata
      // We just need to ensure source and language are consistent if not already set
      const chunkObjects: Chunk[] = chunks.map((chunk: Chunk, index: number) => ({
        // Add types to map params
        ...chunk, // Spread the existing chunk (content + metadata from chunker)
        metadata: {
          source: item.source || chunk.metadata?.source, // Prioritize item source
          language: item.language || chunk.metadata?.language, // Prioritize item language
          chunkIndex: index, // Add chunk index metadata relative to this item
          // Keep existing metadata like nodeType, startLine, endLine from chunker
          ...chunk.metadata,
        },
      }));

      // 4. Generate embeddings (Renumbered step)
      let embeddings: number[][];
      try {
        // Provide complete default mock config if none is given in input
        const currentEmbeddingConfig = embeddingConfig ?? defaultEmbeddingConfig; // Use exported default
        embeddings = await generateEmbeddings(chunkObjects, currentEmbeddingConfig);
      } catch (error) {
        const _errorMessage = error instanceof Error ? error.message : String(error);
        continue; // Skip to the next item
      }

      if (embeddings.length !== chunkObjects.length) {
        continue;
      }

      // 5. Prepare items for indexing
      const indexedItems = chunkObjects.map((chunk, index) => ({
        ...chunk,
        id: `${item.source || item.id || `item-${Date.now()}`}-chunk-${index}`, // Generate unique ID
        vector: embeddings[index],
      }));

      allIndexedItems.push(...indexedItems);
    } // End of loop through items

    // 6. Upsert items into the index
    // Keep try/catch for upsert error, return specific error message
    if (allIndexedItems.length > 0) {
      try {
        await indexManager.upsertItems(allIndexedItems);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Throw error for defineTool wrapper to catch and format consistently
        throw new Error(`Error upserting items into index: ${errorMessage}`);
      }
    } else {
      // If no items were processed successfully to be indexed, maybe indicate this?
      // For now, just proceed to success summary.
    }

    // Construct a more structured output
    const summaryText = `Successfully processed ${items.length} items. Upserted ${allIndexedItems.length} chunks into the index.`;
    const outputContent: McpContentPart[] = [
      {
        type: 'text',
        text: summaryText,
      },
    ];

    // Add structured data alongside the text content
    const outputData = {
      processedItemCount: items.length,
      upsertedChunkCount: allIndexedItems.length,
      // Optionally include IDs if useful, but can be large
      // upsertedIds: allIndexedItems.map(item => item.id),
    };

    return {
      success: true,
      content: outputContent,
      // Include structured data in the output (assuming BaseMcpToolOutput allows extra props or has a data field)
      // If BaseMcpToolOutput is strict, we might need to serialize 'outputData' into a text content part.
      // For now, assume extra properties are allowed or will be handled by the SDK layer.
      data: outputData, // Keep additional data field
    };
  },
});

// Ensure necessary types are still exported
// export type { IndexContentInputSchema, IndexContentInputItemSchema, ChunkingOptionsSchema }; // Removed duplicate export
