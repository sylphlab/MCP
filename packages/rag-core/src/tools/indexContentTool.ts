import { z } from 'zod';
import { McpTool, McpToolInput, BaseMcpToolOutput, McpContentPart, McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Added McpToolExecuteOptions
import { type ChunkingOptions, chunkCodeAst } from '../chunking.js'; // Import interface type
import { EmbeddingModelConfigSchema, generateEmbeddings, EmbeddingModelProvider, defaultEmbeddingConfig } from '../embedding.js'; // Import default config
import { IndexManager, VectorDbConfigSchema, IndexedItem, VectorDbProvider } from '../indexManager.js';
import { SupportedLanguage } from '../parsing.js';
import { Chunk } from '../types.js';
import hljs from 'highlight.js'; // Import highlight.js

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
const ChunkingOptionsSchema = z.object({
    maxChunkSize: z.number().int().positive().optional(),
    chunkOverlap: z.number().int().nonnegative().optional(),
}).optional(); // Make the whole options object optional

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

export const indexContentTool: McpTool<typeof IndexContentInputSchema, BaseMcpToolOutput> = {
  name: 'indexContent',
  description: 'Chunks, embeds, and indexes provided text content.',
  inputSchema: IndexContentInputSchema,
  // outputSchema property removed

  async execute(input: z.infer<typeof IndexContentInputSchema>, options: McpToolExecuteOptions): Promise<BaseMcpToolOutput> { // Remove context, require options
    const { items, chunkingOptions, embeddingConfig, vectorDbConfig } = input;
    // workspaceRoot is now in options.workspaceRoot if needed
    console.log(`indexContentTool: Processing ${items.length} items.`);

    // Provide default config if none is given in input
    const currentIndexConfig = vectorDbConfig ?? { provider: VectorDbProvider.InMemory };
    // Use static create method for async initialization
    const indexManager = await IndexManager.create(currentIndexConfig);

    const allIndexedItems: IndexedItem[] = []; // Explicitly type the array

    for (const item of items) {
      console.log(`Processing item from source: ${item.source || 'unknown'}`);

      let languageToUse: SupportedLanguage | null = item.language ?? null;

      // 2. Detect language if not provided using highlight.js
      if (!languageToUse) {
        // highlightAuto might be slow for very large inputs, consider limiting input size
        // const contentSample = item.content.substring(0, 5000); // Limit sample size
        const detectionResult = hljs.highlightAuto(item.content);
        const detectedLang = detectionResult.language; // Lowercase language name or undefined
        const relevance = detectionResult.relevance;

        console.log(`Highlight.js detection: language=${detectedLang}, relevance=${relevance}, secondBest=${detectionResult.secondBest?.language} (${detectionResult.secondBest?.relevance})`);

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
            console.warn(`Detected language '${detectedLang}' not mapped to a supported AST language or detection failed. Using fallback chunking.`);
            languageToUse = null; // Trigger fallback
        }
      }

      // 3. Chunk the content
      let chunks: Chunk[];
      try {
          // chunkCodeAst will handle fallback if languageToUse is null
          console.log(`Attempting chunking with language: ${languageToUse ?? 'fallback'}`);
          chunks = await chunkCodeAst(item.content, languageToUse, chunkingOptions);
          console.log(`Generated ${chunks.length} chunks.`);
      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error chunking content for source ${item.source || 'unknown'}: ${errorMessage}. Skipping item.`);
          continue; // Skip to the next item
      }

      if (chunks.length === 0) {
        console.warn(`No chunks generated for source: ${item.source || 'unknown'}. Skipping.`);
        continue;
      }

      // The result from chunkCodeAst is already Chunk[] with basic metadata
      // We just need to ensure source and language are consistent if not already set
      const chunkObjects: Chunk[] = chunks.map((chunk: Chunk, index: number) => ({ // Add types to map params
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
          console.log(`Generated ${embeddings.length} embeddings.`);
      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error generating embeddings for source ${item.source || 'unknown'}: ${errorMessage}. Skipping item.`);
          continue; // Skip to the next item
      }


      if (embeddings.length !== chunkObjects.length) {
         console.error(`Mismatch between chunk count (${chunkObjects.length}) and embedding count (${embeddings.length}). Skipping item.`);
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
    if (allIndexedItems.length > 0) {
       try {
           await indexManager.upsertItems(allIndexedItems);
           console.log(`Upserted ${allIndexedItems.length} items into the index.`);
       } catch (error) {
           const errorMessage = error instanceof Error ? error.message : String(error);
           console.error(`Error upserting items into index: ${errorMessage}`);
           return {
               success: false,
               content: [{ type: 'text', text: `Error upserting items into index: ${errorMessage}` }],
           };
       }
    } else {
       console.log("No items to upsert.");
    }


    // Construct a more structured output
    const summaryText = `Successfully processed ${items.length} items. Upserted ${allIndexedItems.length} chunks into the index.`;
    const outputContent: McpContentPart[] = [{
       type: 'text',
       text: summaryText
    }];

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
      data: outputData,
    };
  },
};