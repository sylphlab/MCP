import { embedMany } from 'ai'; // Re-add Vercel AI SDK function
import type { IEmbeddingFunction as ChromaIEmbeddingFunction } from 'chromadb';
import { fetch } from 'node-fetch-native';
import { createOllama } from 'ollama-ai-provider'; // Re-add Ollama provider import
import { z } from 'zod';
import type { Chunk } from './types.js';

// Define and export local interface extending Chroma's if needed, or just use Chroma's
export type IEmbeddingFunction = ChromaIEmbeddingFunction;

export enum EmbeddingModelProvider {
  Mock = 'mock', // For testing
  Ollama = 'ollama',
  Http = 'http', // Add Http provider
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
  batchSize: z.number().int().positive().default(50), // Default batch size for Ollama
  options: z.record(z.unknown()).optional(),
});

// Schema for Http provider
const HttpConfigSchema = z.object({
  provider: z.literal(EmbeddingModelProvider.Http),
  url: z.string().url('A valid URL for the embedding endpoint is required'),
  headers: z.record(z.string()).optional(), // Optional headers (e.g., for authentication)
  batchSize: z.number().int().positive().default(100), // Default batch size for HTTP requests
});

export const EmbeddingModelConfigSchema = z.discriminatedUnion('provider', [
  MockConfigSchema,
  OllamaConfigSchema,
  HttpConfigSchema, // Add Http schema to the union
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
  constructor(private dimension = 768) {}
  public async generate(texts: string[]): Promise<number[][]> {
    return texts.map(() =>
      Array(this.dimension)
        .fill(0)
        .map(() => Math.random()),
    );
  }
}

// Ollama Implementation (using Vercel AI SDK) - Reverted
export class OllamaEmbeddingFunction implements IEmbeddingFunction {
  private ollamaInstance: ReturnType<typeof createOllama>;
  private modelId: string;
  constructor(modelName: string, baseURL?: string) {
    this.ollamaInstance = createOllama({ baseURL }); // Use Vercel AI SDK helper
    this.modelId = modelName;
  }

  public async generate(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    // Use embedMany from Vercel AI SDK
    const { embeddings } = await embedMany({
      model: this.ollamaInstance.embedding(this.modelId),
      values: texts,
    });
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Ollama embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`,
      );
    }
    return embeddings;
  }
}


// Http Implementation (using direct fetch)
export class HttpEmbeddingFunction implements IEmbeddingFunction {
  private url: string;
  private headers: Record<string, string>;
  private batchSize: number;

  constructor(url: string, headers?: Record<string, string>, batchSize = 100) {
    this.url = url;
    this.headers = headers || {};
    this.batchSize = batchSize;
    if (this.url.endsWith('/')) {
        this.url = this.url.slice(0, -1);
    }
  }

  public async generate(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = [];
    const headers = {
      'Content-Type': 'application/json',
      ...this.headers,
    };

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batchTexts = texts.slice(i, i + this.batchSize); // Use this.batchSize

      try {
        const response = await fetch(this.url, {
          method: 'POST',
          headers: headers,
          // Assuming API expects { "input": [...] } or { "texts": [...] } - adjust if needed
          body: JSON.stringify({ input: batchTexts }), // Common pattern, adjust if API differs
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `HTTP error ${response.status}: ${response.statusText}. Body: ${errorBody}`,
          );
        }

        // Assuming API returns { "data": [{ "embedding": [...] }, ...] } or { "embeddings": [[...], ...] }
        const result = await response.json() as any; // Use any for flexibility

        let batchEmbeddings: number[][] | undefined;

        if (result && Array.isArray(result.embeddings)) {
            batchEmbeddings = result.embeddings;
        } else if (result && Array.isArray(result.data) && result.data[0]?.embedding) {
            batchEmbeddings = result.data.map((item: any) => item.embedding);
        } else {
             throw new Error('Invalid response format from HTTP embedding API.');
        }


        if (!batchEmbeddings || batchEmbeddings.length !== batchTexts.length) {
          throw new Error(
            `HTTP embedding count mismatch: expected ${batchTexts.length}, got ${batchEmbeddings?.length ?? 0}`,
          );
        }

        allEmbeddings.push(...batchEmbeddings);
      } catch (error) {
        throw new Error(
          `HTTP embedding generation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return allEmbeddings;
  }
}

/**
 * Generates embeddings for an array of text chunks using configured provider.
 * Uses the specific class instances for generation.
 */
export async function generateEmbeddings(
  chunks: (Chunk | string)[],
  config: EmbeddingModelConfig,
): Promise<EmbeddingVector[]> {
  const textsToEmbed = chunks.map((chunk) => (typeof chunk === 'string' ? chunk : chunk.content));
  if (textsToEmbed.length === 0) return [];

  let embeddingFn: IEmbeddingFunction;

  switch (config.provider) {
    case EmbeddingModelProvider.Mock: {
      embeddingFn = new MockEmbeddingFunction(config.mockDimension);
      break;
    }
    case EmbeddingModelProvider.Ollama: {
      embeddingFn = new OllamaEmbeddingFunction(config.modelName, config.baseURL);
      break;
    }
    case EmbeddingModelProvider.Http: {
      embeddingFn = new HttpEmbeddingFunction(config.url, config.headers, config.batchSize);
      break;
    }
    default: {
      const exhaustiveCheck: never = config;
      throw new Error(`Unhandled embedding provider: ${exhaustiveCheck}`);
    }
  }

  // Determine batch size from config or use a default reasonable for the function
  const batchSize = config.batchSize || (config.provider === EmbeddingModelProvider.Ollama ? 50 : 100);
  const allEmbeddings: number[][] = [];

  // Process in batches according to the function's preferred batch size
  for (let i = 0; i < textsToEmbed.length; i += batchSize) {
      const batchTexts = textsToEmbed.slice(i, i + batchSize);
      try {
          const batchEmbeddings = await embeddingFn.generate(batchTexts);
          if (batchEmbeddings.length !== batchTexts.length) {
               console.warn(`Embedding batch size mismatch for provider ${config.provider}. Expected ${batchTexts.length}, got ${batchEmbeddings.length}.`);
               // Decide how to handle: throw, skip, pad? For now, let's throw.
               throw new Error('Embedding batch size mismatch.');
          }
          allEmbeddings.push(...batchEmbeddings);
      } catch (error) {
          console.error(`Error generating embedding batch (index ${i}) for provider ${config.provider}:`, error);
          // Decide how to handle: throw, skip batch, return partial? Re-throwing for now.
          throw error;
      }
  }

  return allEmbeddings;
}
