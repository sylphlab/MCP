import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbeddings, VercelAIEmbeddingFunction } from './embedding.js';
import { openai } from '@ai-sdk/openai';

// Mock the Vercel AI SDK's embed function and openai provider
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn().mockReturnValue({
      // Mock the structure returned by openai.embedding()
      provider: 'openai',
      modelId: 'mock-embedding-model',
      doEmbed: vi.fn(async ({ values }: { values: string[] }) => {
        // Return dummy embeddings based on input length or content
        console.log(`Mock doEmbed called with ${values.length} values.`);
        return {
          embeddings: values.map(v => Array(1536).fill(v.length * 0.1)), // Example dummy embedding
          usage: { promptTokens: values.length * 10, totalTokens: values.length * 10 }
        };
      }),
      // Add other necessary properties if the type requires them
      maxEmbeddingsPerCall: 100,
      supportsParallelCalls: true,
      specificationVersion: 'v1',
    }),
  },
}));

vi.mock('ai', async (importOriginal) => {
    const original = await importOriginal() as typeof import('ai');
    return {
        ...original,
        embed: vi.fn(async ({ model, values }: { model: any, values: string[] }) => {
             // Simulate calling the mocked model's doEmbed
             console.log(`Mock embed called with ${values.length} values for model ${model.modelId}.`);
             if (model?.doEmbed) {
                 return model.doEmbed({ values });
             }
             // Fallback if model structure is unexpected
             return { embeddings: values.map(() => Array(1536).fill(0.5)) };
        }),
    };
});


describe('embedding', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Reset environment variables if necessary
    delete process.env.OPENAI_API_KEY;
  });

  it('should throw error if OPENAI_API_KEY is not set', async () => {
    await expect(generateEmbeddings(['test'])).rejects.toThrow(
      'OPENAI_API_KEY environment variable is not set for embedding model.'
    );
  });

  it('should generate embeddings for a single chunk', async () => {
    process.env.OPENAI_API_KEY = 'test-key'; // Set dummy key
    const chunks = ['hello world'];
    const embeddings = await generateEmbeddings(chunks);

    expect(embeddings).toHaveLength(1);
    expect(embeddings[0]).toHaveLength(1536); // Assuming dimension 1536
    expect(embeddings[0][0]).toBeCloseTo(chunks[0].length * 0.1); // Check dummy value
    expect(openai.embedding).toHaveBeenCalledWith(expect.any(String)); // Check model init
    expect(vi.mocked(await import('ai')).embed).toHaveBeenCalledOnce(); // Check embed call
  });

   it('should generate embeddings for multiple chunks', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const chunks = ['chunk 1', 'chunk 2 is longer'];
    const embeddings = await generateEmbeddings(chunks);

    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(1536);
    expect(embeddings[1]).toHaveLength(1536);
    expect(embeddings[0][0]).toBeCloseTo(chunks[0].length * 0.1);
    expect(embeddings[1][0]).toBeCloseTo(chunks[1].length * 0.1);
    expect(vi.mocked(await import('ai')).embed).toHaveBeenCalledOnce();
  });

  it('should handle empty input array', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const chunks: string[] = [];
    const embeddings = await generateEmbeddings(chunks);
    expect(embeddings).toEqual([]);
    expect(vi.mocked(await import('ai')).embed).not.toHaveBeenCalled();
  });

  describe('VercelAIEmbeddingFunction (for ChromaDB)', () => {
     it('should call generateEmbeddings when generate is invoked', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        const embeddingFn = new VercelAIEmbeddingFunction();
        const texts = ['text 1', 'text 2'];
        const results = await embeddingFn.generate(texts);

        expect(results).toHaveLength(2);
        expect(results[0]).toHaveLength(1536);
        expect(results[1]).toHaveLength(1536);
        expect(vi.mocked(await import('ai')).embed).toHaveBeenCalledOnce();
     });
  });

});