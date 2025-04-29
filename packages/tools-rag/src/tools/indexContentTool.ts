import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Add ToolExecuteOptions import
import hljs from 'highlight.js';
import { z } from 'zod';
import { type ChunkingOptions, chunkCodeAst } from '../chunking.js';
import {
  // EmbeddingModelConfigSchema, // No longer needed in input schema
  EmbeddingModelProvider,
  // defaultEmbeddingConfig, // Config comes from options
  generateEmbeddings,
} from '../embedding.js';
import {
  IndexManager,
  type IndexedItem,
  // VectorDbConfigSchema, // No longer needed in input schema
  VectorDbProvider,
} from '../indexManager.js';
import { SupportedLanguage } from '../parsing.js';
import type { Chunk, RagToolExecuteOptions } from '../types.js'; // Use the shared options type

// --- Input Schemas ---
export const IndexContentInputItemSchema = z.object({
  id: z.string().optional(),
  content: z.string(),
  source: z.string().optional(),
  language: z.nativeEnum(SupportedLanguage).optional(),
});

const ChunkingOptionsSchema = z
  .object({
    maxChunkSize: z.number().int().positive().optional(),
    chunkOverlap: z.number().int().nonnegative().optional(),
  })
  .optional();

// Input schema no longer includes vectorDbConfig or embeddingConfig
export const IndexContentInputSchema = z.object({
  items: z.array(IndexContentInputItemSchema),
  chunkingOptions: ChunkingOptionsSchema,
});

// --- TypeScript Types ---
export type IndexContentInputItem = z.infer<typeof IndexContentInputItemSchema>;
export type IndexContentToolInput = z.infer<typeof IndexContentInputSchema>;

// --- Output Types ---
export interface IndexContentResultItem {
  /** Optional ID from the input item. */
  id?: string;
  /** Source provided in the input item. */
  source?: string;
  /** Whether processing this item (chunking, embedding, indexing) was successful overall. */
  success: boolean;
  /** Number of chunks generated and upserted for this item. */
  chunksUpserted: number;
  /** Error message, if processing failed for this item. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const IndexContentResultItemSchema = z.object({
  id: z.string().optional(),
  source: z.string().optional(),
  success: z.boolean(),
  chunksUpserted: z.number().int().nonnegative(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const IndexContentOutputSchema = z.array(IndexContentResultItemSchema);

// --- Tool Definition using defineTool ---
export const indexContentTool = defineTool({
  name: 'index-content',
  description: 'Chunks, embeds, and indexes provided text content.',
  inputSchema: IndexContentInputSchema,


  execute: async (
    input: IndexContentToolInput,
    options: ToolExecuteOptions, // Keep base type for compatibility
  ): Promise<Part[]> => {
    // Zod validation
    const parsed = IndexContentInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items, chunkingOptions } = parsed.data;

    // Assert options type to access indexManager and ragConfig
    const ragOptions = options as RagToolExecuteOptions;
    if (!ragOptions.indexManager || !ragOptions.ragConfig) {
      throw new Error('IndexManager instance or RagConfig is missing in ToolExecuteOptions.');
    }
    // Check if the manager instance itself is initialized
    if (!ragOptions.indexManager.isInitialized()) {
        throw new Error('IndexManager is not initialized. Cannot index content.');
    }
    const indexManager = ragOptions.indexManager;
    const { embedding: embeddingConfig } = ragOptions.ragConfig; // Get embedding config

    const results: IndexContentResultItem[] = [];

    for (const item of items) {
      const itemResult: IndexContentResultItem = {
        id: item.id,
        source: item.source,
        success: false,
        chunksUpserted: 0,
      };

      try {
        let languageToUse: SupportedLanguage | null = item.language ?? null;

        // Detect language if not provided
        if (!languageToUse && item.content) {
          const detectionResult = hljs.highlightAuto(item.content);
          const detectedLang = detectionResult.language;
          switch (detectedLang?.toLowerCase()) {
            case 'javascript': case 'js': case 'jsx':
              languageToUse = SupportedLanguage.JavaScript; break;
            case 'typescript': case 'ts': case 'tsx':
              languageToUse = SupportedLanguage.TypeScript; break;
            case 'python': case 'py':
              languageToUse = SupportedLanguage.Python; break;
            default: languageToUse = null;
          }
        }

        // Chunk the content
        const chunks = await chunkCodeAst(item.content, languageToUse, chunkingOptions);
        if (chunks.length === 0) {
          itemResult.success = true;
          results.push(itemResult);
          continue;
        }

        const chunkObjects: Chunk[] = chunks.map((chunk, index) => ({
          ...chunk,
          metadata: {
            source: item.source || chunk.metadata?.source,
            language: languageToUse || chunk.metadata?.language,
            chunkIndex: index,
            ...chunk.metadata,
          },
        }));

        // Generate embeddings using config from options
        const embeddings = await generateEmbeddings(chunkObjects, embeddingConfig);
        if (embeddings.length !== chunkObjects.length) {
          throw new Error('Mismatch between number of chunks and generated embeddings.');
        }

        // Prepare items for indexing
        const indexedItems: IndexedItem[] = chunkObjects.map((chunk, index) => ({
          ...chunk,
          id: `${item.source || item.id || `item-${Date.now()}`}-chunk-${index}`,
          vector: embeddings[index],
        }));

        // Upsert items using the indexManager from options
        await indexManager.upsertItems(indexedItems);

        itemResult.success = true;
        itemResult.chunksUpserted = indexedItems.length;
      } catch (error: unknown) {
        itemResult.success = false;
        itemResult.error = error instanceof Error ? error.message : String(error);
        // Add basic suggestion
        if (itemResult.error.includes('embedding') || itemResult.error.includes('Embedding')) {
          itemResult.suggestion = 'Check embedding model configuration and API key/endpoint validity.';
        } else if (itemResult.error.includes('index') || itemResult.error.includes('Index') || itemResult.error.includes('upsert')) {
          itemResult.suggestion = 'Check vector database configuration and connectivity.';
        } else if (itemResult.error.includes('chunk') || itemResult.error.includes('Chunk')) {
          itemResult.suggestion = 'Check chunking options and content validity for the detected/specified language.';
        } else {
          itemResult.suggestion = 'An unexpected error occurred during processing.';
        }
      }
      results.push(itemResult);
    } // End of loop through items

    // Return the results wrapped in jsonPart
    return [jsonPart(results, IndexContentOutputSchema)];
  },
});

// Export necessary types
