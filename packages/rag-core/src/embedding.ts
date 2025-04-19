import { z } from 'zod';
import { Chunk } from './types.js';
import { embedMany } from 'ai'; // Import Vercel AI SDK function
import { createOllama } from 'ollama-ai-provider'; // Import Ollama provider

export enum EmbeddingModelProvider {
  Mock = 'mock', // For testing
  Ollama = 'ollama',
  // Add other Vercel AI SDK compatible providers later if needed (e.g., OpenAI via @ai-sdk/openai)
}

// Define schemas for each provider's specific config
const MockConfigSchema = z.object({
  provider: z.literal(EmbeddingModelProvider.Mock),
  mockDimension: z.number().int().positive().default(768), // Default to a common dimension
  batchSize: z.number().int().positive().default(32), // Mock batch size (less relevant)
});

const OllamaConfigSchema = z.object({
  provider: z.literal(EmbeddingModelProvider.Ollama),
  modelName: z.string().default('nomic-embed-text'), // Default Ollama embedding model
  baseURL: z.string().url().optional(), // Optional custom Ollama API base URL
  batchSize: z.number().int().positive().default(50), // Adjust based on Ollama performance/limits
  // Add embedding specific options if ollama-ai-provider supports them
  options: z.record(z.unknown()).optional(),
});


// Use discriminated union for the main config schema
export const EmbeddingModelConfigSchema = z.discriminatedUnion("provider", [
  MockConfigSchema,
  OllamaConfigSchema,
  // Add other provider schemas here
]);

export type EmbeddingModelConfig = z.infer<typeof EmbeddingModelConfigSchema>;

// Default config (using Mock)
export const defaultEmbeddingConfig: EmbeddingModelConfig = {
  provider: EmbeddingModelProvider.Mock,
  mockDimension: 768, // Match default in schema
  batchSize: 32,    // Match default in schema
};


/**
 * Represents an embedding vector.
 */
export type EmbeddingVector = number[];

/**
 * Generates embeddings for an array of text chunks using Vercel AI SDK providers.
 *
 * @param chunks An array of Chunk objects or simple strings.
 * @param config Configuration for the embedding model provider.
 * @returns A promise that resolves to an array of embedding vectors, corresponding to the input chunks.
 */
export async function generateEmbeddings(
  chunks: (Chunk | string)[],
  config: EmbeddingModelConfig // Require config
): Promise<EmbeddingVector[]> {
  console.log(`Generating embeddings using ${config.provider}...`);

  const textsToEmbed = chunks.map(chunk => typeof chunk === 'string' ? chunk : chunk.content);

  if (textsToEmbed.length === 0) {
    return [];
  }

  try {
    switch (config.provider) {
      case EmbeddingModelProvider.Mock:
        // Use mockDimension from validated config
        console.warn('Using Mock embedding provider. Generating dummy embeddings.');
        return textsToEmbed.map(() => Array(config.mockDimension).fill(0).map(() => Math.random()));

      case EmbeddingModelProvider.Ollama:
        const ollama = createOllama({ baseURL: config.baseURL });
        // Use embedMany from 'ai' package
        // Note: embedMany handles batching internally based on provider capabilities,
        // but we might still want to chunk our input array if it's extremely large
        // to avoid overwhelming the initial call or memory usage.
        // The config.batchSize here is more of a hint for potential pre-chunking if needed.
        console.log(`Using Ollama model: ${config.modelName}, BaseURL: ${config.baseURL || 'default'}`);

        // TODO: Implement pre-chunking if textsToEmbed.length > large_threshold (e.g., > 1000?)
        // using config.batchSize

        const { embeddings, usage } = await embedMany({
          model: ollama.embedding(config.modelName), // Remove unsupported options object
          values: textsToEmbed,
          // Add other embedMany options if needed (maxRetries, abortSignal, headers)
        });

        // console.log(`Ollama embedding usage: ${usage?.promptTokens ?? 'N/A'} prompt tokens`); // Removed - Property doesn't exist

        if (embeddings.length !== textsToEmbed.length) {
           throw new Error(`Ollama embedding count mismatch: expected ${textsToEmbed.length}, got ${embeddings.length}`);
        }
        return embeddings;

      default:
        // This should be unreachable due to Zod validation, but good practice
        const exhaustiveCheck: never = config;
        throw new Error(`Unhandled embedding provider: ${exhaustiveCheck}`);
    }
  } catch (error) {
     console.error(`Error generating embeddings with ${config.provider}:`, error);
     // TODO: Improve error handling - classify errors (config, network, API), potentially retry?
     // For now, re-throw the error to fail the operation.
     throw error;
  }
}