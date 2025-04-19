import { z } from 'zod';
import { Chunk } from './types.js';
import { embedMany } from 'ai'; // Import Vercel AI SDK function
import { createOllama } from 'ollama-ai-provider'; // Import Ollama provider
import type { IEmbeddingFunction as ChromaIEmbeddingFunction } from 'chromadb'; // Import the type

// Define and export local interface extending Chroma's if needed, or just use Chroma's
export type IEmbeddingFunction = ChromaIEmbeddingFunction;

export enum EmbeddingModelProvider {
  Mock = 'mock', // For testing
  Ollama = 'ollama',
}

// Define schemas for each provider's specific config
const MockConfigSchema = z.object({
  provider: z.literal(EmbeddingModelProvider.Mock),
  mockDimension: z.number().int().positive().default(768),
  batchSize: z.number().int().positive().default(32),
});

const OllamaConfigSchema = z.object({
  provider: z.literal(EmbeddingModelProvider.Ollama),
  modelName: z.string().default('nomic-embed-text'),
  baseURL: z.string().url().optional(),
  batchSize: z.number().int().positive().default(50),
  options: z.record(z.unknown()).optional(),
});

export const EmbeddingModelConfigSchema = z.discriminatedUnion("provider", [
  MockConfigSchema,
  OllamaConfigSchema,
]);

export type EmbeddingModelConfig = z.infer<typeof EmbeddingModelConfigSchema>;

export const defaultEmbeddingConfig: EmbeddingModelConfig = {
  provider: EmbeddingModelProvider.Mock,
  mockDimension: 768,
  batchSize: 32,
};

export type EmbeddingVector = number[];

// --- Custom Embedding Function Implementations ---

// Mock Implementation
export class MockEmbeddingFunction implements IEmbeddingFunction {
    constructor(private dimension: number = 768) {}
    public async generate(texts: string[]): Promise<number[][]> {
        console.warn(`Using MockEmbeddingFunction. Generating dummy embeddings of dimension ${this.dimension}.`);
        return texts.map(() => Array(this.dimension).fill(0).map(() => Math.random()));
    }
}

// Ollama Implementation (using Vercel AI SDK)
export class OllamaEmbeddingFunction implements IEmbeddingFunction {
    private ollamaInstance: ReturnType<typeof createOllama>;
    private modelId: string;
    constructor(modelName: string, baseURL?: string) {
        this.ollamaInstance = createOllama({ baseURL });
        this.modelId = modelName;
        console.log(`OllamaEmbeddingFunction initialized for model: ${this.modelId}, BaseURL: ${baseURL || 'default'}`);
    }

    public async generate(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];
        try {
            console.log(`Generating Ollama embeddings for ${texts.length} texts using model ${this.modelId}...`);
            const { embeddings } = await embedMany({
                model: this.ollamaInstance.embedding(this.modelId),
                values: texts,
            });
             if (embeddings.length !== texts.length) {
                throw new Error(`Ollama embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`);
            }
            console.log(`Successfully generated ${embeddings.length} Ollama embeddings.`);
            return embeddings;
        } catch(error) {
            console.error(`Ollama embedding generation failed for model ${this.modelId}:`, error);
            throw error;
        }
    }
}

/**
 * Generates embeddings for an array of text chunks using configured provider.
 * DEPRECATED in favor of using specific class instances.
 */
export async function generateEmbeddings(
  chunks: (Chunk | string)[],
  config: EmbeddingModelConfig
): Promise<EmbeddingVector[]> {
  console.warn("DEPRECATED: generateEmbeddings function called. Use specific embedding function classes instead.");
  console.log(`Generating embeddings using ${config.provider}...`);
  const textsToEmbed = chunks.map(chunk => typeof chunk === 'string' ? chunk : chunk.content);
  if (textsToEmbed.length === 0) return [];
  try {
    switch (config.provider) {
      case EmbeddingModelProvider.Mock:
        const mockFn = new MockEmbeddingFunction(config.mockDimension);
        return mockFn.generate(textsToEmbed);
      case EmbeddingModelProvider.Ollama:
         const ollamaFn = new OllamaEmbeddingFunction(config.modelName, config.baseURL);
         return ollamaFn.generate(textsToEmbed);
      default:
        const exhaustiveCheck: never = config;
        throw new Error(`Unhandled embedding provider: ${exhaustiveCheck}`);
    }
  } catch (error) {
     console.error(`Error generating embeddings with ${config.provider}:`, error);
     throw error;
  }
}
