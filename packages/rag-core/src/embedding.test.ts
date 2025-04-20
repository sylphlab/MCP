import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import {
    generateEmbeddings,
    EmbeddingModelProvider,
    defaultEmbeddingConfig,
    EmbeddingModelConfig,
    HttpEmbeddingFunction,
    MockEmbeddingFunction,
    OllamaEmbeddingFunction
} from './embedding.js';
import { embedMany } from 'ai'; // Import embedMany
import { createOllama } from 'ollama-ai-provider'; // Import createOllama
import { Chunk } from './types.js'; // Import Chunk type

import fetch from 'node-fetch-native';
// Mock the Vercel AI SDK's embedMany function
vi.mock('ai', async (importOriginal) => {
    const original = await importOriginal() as typeof import('ai');
    return {
        ...original,
        embedMany: vi.fn(async ({ model, values }: { model: any, values: string[] }) => {
             console.log(`Mock embedMany called with ${values.length} values for model ${model.modelId}.`);
             // Simulate Ollama or other provider behavior - return dummy embeddings
             return {
                 embeddings: values.map(v => Array(768).fill(v.length * 0.1)), // Use a default dimension
                 // usage: { promptTokens: values.length * 5 } // Mock usage - 'usage' might not be standard on embedMany result
             };
        }),
    };
});

// Mock ollama-ai-provider
vi.mock('ollama-ai-provider', () => ({
    createOllama: vi.fn().mockReturnValue({
        // Mock the embedding function returned by createOllama().embedding()
        embedding: vi.fn().mockReturnValue({
            provider: 'ollama',
            modelId: 'mock-ollama-model',
            // Mock any methods/properties needed by embedMany if not directly using doEmbed
        }),
    }),
}));


// Mock node-fetch-native
vi.mock('node-fetch-native', () => ({
    default: vi.fn(),
}));
const mockedFetch = vi.mocked(fetch);

describe('embedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use Mock provider by default and return dummy embeddings', async () => {
    const chunks = ['hello', 'world'];
    // Use default config which is Mock
    const embeddings = await generateEmbeddings(chunks, defaultEmbeddingConfig);

    expect(embeddings).toHaveLength(2);
    // Type guard for accessing mockDimension
    if (defaultEmbeddingConfig.provider === EmbeddingModelProvider.Mock) {
      expect(embeddings[0]).toHaveLength(defaultEmbeddingConfig.mockDimension);
      expect(embeddings[1]).toHaveLength(defaultEmbeddingConfig.mockDimension);
    } else {
      // Fail test if default config is not Mock (shouldn't happen)
      expect(defaultEmbeddingConfig.provider).toBe(EmbeddingModelProvider.Mock);
    }
    // Check if values are random (or fixed if mock is deterministic)
    expect(embeddings[0][0]).toBeGreaterThanOrEqual(0);
    expect(embeddings[0][0]).toBeLessThanOrEqual(1);
    const mockedEmbedMany = vi.mocked(embedMany);
    expect(mockedEmbedMany).not.toHaveBeenCalled(); // embedMany should not be called for Mock
  });

   it('should call Ollama provider and embedMany when configured', async () => {
    const chunks = ['ollama test'];
    const config: EmbeddingModelConfig = {
        provider: EmbeddingModelProvider.Ollama,
        modelName: 'nomic-embed-text',
        baseURL: 'http://localhost:11434',
        batchSize: 10, // This batchSize is currently informational for potential pre-chunking
    };
    const embeddings = await generateEmbeddings(chunks, config);

    expect(createOllama).toHaveBeenCalledWith({ baseURL: config.baseURL });
    const mockedEmbedMany = vi.mocked(embedMany); // Get the mocked function correctly
    expect(mockedEmbedMany).toHaveBeenCalledOnce();
    expect(mockedEmbedMany).toHaveBeenCalledWith(expect.objectContaining({
        // Check if the model passed to embedMany has the expected properties
        model: expect.objectContaining({ provider: 'ollama', modelId: 'mock-ollama-model' }),
        values: [chunks[0]],
    }));
    expect(embeddings).toHaveLength(1);
    expect(embeddings[0]).toHaveLength(768); // Based on mock embedMany return
    expect(embeddings[0][0]).toBeCloseTo(chunks[0].length * 0.1);
  });

  it('should handle empty input array', async () => {
    const chunks: string[] = [];
    const embeddings = await generateEmbeddings(chunks, defaultEmbeddingConfig);
    expect(embeddings).toEqual([]);
    const mockedEmbedMany = vi.mocked(embedMany);
    expect(mockedEmbedMany).not.toHaveBeenCalled();
  });

  it('should accept Chunk objects as input', async () => {
      const chunks: Chunk[] = [
          { id: 'c1', content: 'content 1', metadata: { source: 's1'} },
          { id: 'c2', content: 'content 2' } // No metadata
      ];
      const embeddings = await generateEmbeddings(chunks, defaultEmbeddingConfig);
      expect(embeddings).toHaveLength(2);
      // Type guard for accessing mockDimension
      if (defaultEmbeddingConfig.provider === EmbeddingModelProvider.Mock) {


  describe('HttpEmbeddingFunction', () => {
    const testUrl = 'http://localhost:8080/embed';
    const testHeaders = { 'Authorization': 'Bearer test-token' };
    const batchSize = 2;
    let httpEmbedFn: HttpEmbeddingFunction;

    beforeEach(() => {
      // Reset fetch mock before each test
      mockedFetch.mockReset();
      httpEmbedFn = new HttpEmbeddingFunction(testUrl, testHeaders, batchSize);
    });

    it('should make a POST request with correct headers and body (single batch)', async () => {
      const texts = ['text1', 'text2'];
      const mockEmbeddings = [[0.1, 0.2], [0.3, 0.4]];
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ embeddings: mockEmbeddings }),
        text: async () => JSON.stringify({ embeddings: mockEmbeddings }),
      } as Response);

      const embeddings = await httpEmbedFn.generate(texts);

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(mockedFetch).toHaveBeenCalledWith(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...testHeaders },
        body: JSON.stringify({ texts }),
      });
      expect(embeddings).toEqual(mockEmbeddings);
    });

    it('should handle multiple batches correctly', async () => {
      const texts = ['t1', 't2', 't3', 't4', 't5']; // 5 texts, batchSize 2 -> 3 batches
      const mockEmbeddings1 = [[1], [2]];
      const mockEmbeddings2 = [[3], [4]];
      const mockEmbeddings3 = [[5]];

      mockedFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ embeddings: mockEmbeddings1 }), text: async () => '' } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ embeddings: mockEmbeddings2 }), text: async () => '' } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ embeddings: mockEmbeddings3 }), text: async () => '' } as Response);

      const embeddings = await httpEmbedFn.generate(texts);

      expect(mockedFetch).toHaveBeenCalledTimes(3);
      expect(mockedFetch).toHaveBeenNthCalledWith(1, testUrl, expect.objectContaining({ body: JSON.stringify({ texts: ['t1', 't2'] }) }));
      expect(mockedFetch).toHaveBeenNthCalledWith(2, testUrl, expect.objectContaining({ body: JSON.stringify({ texts: ['t3', 't4'] }) }));
      expect(mockedFetch).toHaveBeenNthCalledWith(3, testUrl, expect.objectContaining({ body: JSON.stringify({ texts: ['t5'] }) }));
      expect(embeddings).toEqual([...mockEmbeddings1, ...mockEmbeddings2, ...mockEmbeddings3]);
    });

    it('should handle empty input array', async () => {
      const embeddings = await httpEmbedFn.generate([]);
      expect(embeddings).toEqual([]);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('should throw an error on HTTP failure', async () => {
      const texts = ['test'];
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'failed' }),
        text: async () => 'Internal Server Error Body',
      } as Response);

      await expect(httpEmbedFn.generate(texts)).rejects.toThrow(/HTTP error 500: Internal Server Error. Body: Internal Server Error Body/);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw an error on invalid response format', async () => {
      const texts = ['test'];
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ wrong_key: [] }), // Invalid format
        text: async () => JSON.stringify({ wrong_key: [] }),
      } as Response);

      await expect(httpEmbedFn.generate(texts)).rejects.toThrow(/Invalid response format from embedding API/);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

     it('should throw an error on embedding count mismatch', async () => {
      const texts = ['text1', 'text2'];
      const mockEmbeddings = [[0.1, 0.2]]; // Only one embedding returned
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ embeddings: mockEmbeddings }),
        text: async () => JSON.stringify({ embeddings: mockEmbeddings }),
      } as Response);

      await expect(httpEmbedFn.generate(texts)).rejects.toThrow(/HTTP embedding count mismatch: expected 2, got 1/);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

  });
        expect(embeddings[0]).toHaveLength(defaultEmbeddingConfig.mockDimension);
        expect(embeddings[1]).toHaveLength(defaultEmbeddingConfig.mockDimension);
      } else {
        expect(defaultEmbeddingConfig.provider).toBe(EmbeddingModelProvider.Mock);
      }
      // Mock provider doesn't call embedMany
      const mockedEmbedMany = vi.mocked(embedMany);
      expect(mockedEmbedMany).not.toHaveBeenCalled();
  });

  // Removed tests related to VercelAIEmbeddingFunction

});