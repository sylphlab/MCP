import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { generateEmbeddings, EmbeddingModelProvider, defaultEmbeddingConfig, EmbeddingModelConfig } from './embedding.js';
import { embedMany } from 'ai'; // Import embedMany
import { createOllama } from 'ollama-ai-provider'; // Import createOllama
import { Chunk } from './types.js'; // Import Chunk type

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