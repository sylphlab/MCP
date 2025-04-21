import { z } from 'zod';
import type { Chunk } from './types.js';
import { embedMany } from 'ai'; // Import Vercel AI SDK function
import { createOllama } from 'ollama-ai-provider'; // Import Ollama provider
import type { IEmbeddingFunction as ChromaIEmbeddingFunction } from 'chromadb'; // Import the type
import { fetch } from 'node-fetch-native'; // Use node-fetch-native for reliable fetch

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
  batchSize: z.number().int().positive().default(50),
  options: z.record(z.unknown()).optional(),
});

// Schema for Http provider
const HttpConfigSchema = z.object({
    provider: z.literal(EmbeddingModelProvider.Http),
    url: z.string().url("A valid URL for the embedding endpoint is required"),
    headers: z.record(z.string()).optional(), // Optional headers (e.g., for authentication)
    batchSize: z.number().int().positive().default(100), // Default batch size for HTTP requests
});


export const EmbeddingModelConfigSchema = z.discriminatedUnion("provider", [
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

// Http Implementation
export class HttpEmbeddingFunction implements IEmbeddingFunction {
    private url: string;
    private headers: Record<string, string>;
    private batchSize: number;

    constructor(url: string, headers?: Record<string, string>, batchSize = 100) {
        this.url = url;
        this.headers = headers || {};
        this.batchSize = batchSize;
        console.log(`HttpEmbeddingFunction initialized for URL: ${this.url}, Batch Size: ${this.batchSize}`);
    }

    public async generate(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];
        console.log(`Generating HTTP embeddings for ${texts.length} texts via ${this.url}...`);

        const allEmbeddings: number[][] = [];
        const headers = {
            'Content-Type': 'application/json',
            ...this.headers,
        };

        for (let i = 0; i < texts.length; i += this.batchSize) {
            const batchTexts = texts.slice(i, i + this.batchSize);
            console.log(`Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(texts.length / this.batchSize)} (size: ${batchTexts.length})`);

            try {
                const response = await fetch(this.url, {
                    method: 'POST',
                    headers: headers,
                    // Assuming API expects { "texts": [...] }
                    body: JSON.stringify({ texts: batchTexts }),
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}. Body: ${errorBody}`);
                }

                // Assuming API returns { "embeddings": [[...], ...] }
                const result = await response.json() as { embeddings: number[][] };

                if (!result || !Array.isArray(result.embeddings)) {
                    throw new Error('Invalid response format from embedding API. Expected { "embeddings": [...] }.');
                }

                if (result.embeddings.length !== batchTexts.length) {
                    throw new Error(`HTTP embedding count mismatch: expected ${batchTexts.length}, got ${result.embeddings.length}`);
                }

                allEmbeddings.push(...result.embeddings);

            } catch (error) {
                console.error(`HTTP embedding generation failed for batch starting at index ${i}:`, error);
                // Re-throw the error to stop the process if a batch fails
                throw new Error(`HTTP embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        console.log(`Successfully generated ${allEmbeddings.length} HTTP embeddings.`);
        return allEmbeddings;
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
      case EmbeddingModelProvider.Http:
         const httpFn = new HttpEmbeddingFunction(config.url, config.headers, config.batchSize);
         return httpFn.generate(textsToEmbed);
      default:
        const exhaustiveCheck: never = config;
        throw new Error(`Unhandled embedding provider: ${exhaustiveCheck}`);
    }
  } catch (error) {
     console.error(`Error generating embeddings with ${config.provider}:`, error);
     throw error;
  }
}
