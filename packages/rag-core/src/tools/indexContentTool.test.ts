import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part and McpToolExecuteOptions
import hljs from 'highlight.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import * as chunkingModule from '../chunking.js';
import { EmbeddingModelProvider } from '../embedding.js';
import * as embeddingModule from '../embedding.js';
import { IndexManager, VectorDbProvider } from '../indexManager.js';
import { SupportedLanguage } from '../parsing.js';
import type { Chunk } from '../types.js';
import { type IndexContentInputSchema, indexContentTool } from './indexContentTool.js';
import type { IndexContentResultItem } from './indexContentTool.js'; // Import correct result type

// --- Mocks ---
vi.mock('../chunking.js');
vi.mock('../embedding.js');
vi.mock('../indexManager.js');
vi.mock('highlight.js');
vi.mock('../embedding.js', (_importOriginal) => {
// Helper to extract JSON result from parts
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  // console.log('DEBUG: getJsonResult received parts:', JSON.stringify(parts, null, 2)); // Keep commented for now
  const jsonPart = parts.find(part => part.type === 'json');
  // console.log('DEBUG: Found jsonPart:', JSON.stringify(jsonPart, null, 2)); // Keep commented for now
  // Check if jsonPart exists and has a 'value' property (which holds the actual data)
  if (jsonPart && jsonPart.value !== undefined) {
    // console.log('DEBUG: Attempting to use jsonPart.value directly'); // Keep commented for now
      // Assuming the value is already the correct array type based on defineTool's outputSchema
      return jsonPart.value as T[];
    } catch (e) 
      return undefined;
  }
    }
    }
  // Mock instance for IndexManager
  const mockIndexManagerInstance = {
    vi.resetAllMocks(); // Reset all mocks

    // Mock static create method to return the mock instance
    vi.mocked(IndexManager.create).mockResolvedValue(mockIndexManagerInstance as any);

    // Disable console logging
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore console and other potential spies
  });

  // Helper to create valid input
  const createValidInput = (overrides = {}): z.infer<typeof IndexContentInputSchema> => ({
    items: [{ content: 'const x = 1;', language: SupportedLanguage.JavaScript, source: 'file.js' }],
    chunkingOptions: { maxChunkSize: 100 },
    embeddingConfig: {
      provider: EmbeddingModelProvider.Ollama,
      modelName: 'test-model',
      batchSize: 1,
    },
    vectorDbConfig: { provider: VectorDbProvider.ChromaDB, collectionName: 'test-coll' },
    ...overrides,
  });

  it('should successfully process an item with provided language', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [
      { id: 'chunk-1', content: 'const x = 1;', metadata: { startLine: 1, endLine: 1 } },
    ];
    const embeddings = [[0.1, 0.2]];
    const expectedIndexedItems = [
      {
        ...chunks[0],
        id: expect.stringContaining('file.js-chunk-0'),
        vector: embeddings[0],
        metadata: {
          ...chunks[0].metadata,
          source: 'file.js',
          language: SupportedLanguage.JavaScript,
          chunkIndex: 0,
        },
      },
    ];

    // Setup mocks for this test
    vi.mocked(chunkingModule.chunkCodeAst).mockResolvedValue(chunks);
    vi.mocked(embeddingModule.generateEmbeddings).mockResolvedValue(embeddings);
    const highlightAutoSpy = vi.spyOn(hljs, 'highlightAuto');

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(IndexManager.create).toHaveBeenCalledWith(input.vectorDbConfig);
    expect(chunkingModule.chunkCodeAst).toHaveBeenCalledWith(
      input.items[0].content,
      input.items[0].language,
      input.chunkingOptions,
    );
    expect(embeddingModule.generateEmbeddings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            source: 'file.js',
            language: SupportedLanguage.JavaScript,
          }),
        }),
      ]),
      input.embeddingConfig,
    );
    expect(mockUpsertItemsInstance).toHaveBeenCalledWith(expectedIndexedItems);
    expect(highlightAutoSpy).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.chunksUpserted).toBe(1);
    expect(itemResult.error).toBeUndefined();
  });

  it('should use language detection when language is not provided', async () => {
    const input = createValidInput({ items: [{ content: 'print("hello")', source: 'script.py' }] }); // No language
    const chunks: Chunk[] = [{ id: 'chunk-py', content: 'print("hello")', metadata: {} }];
    const embeddings = [[0.3, 0.4]];

    // Setup mocks
    vi.mocked(hljs.highlightAuto).mockReturnValue({ language: 'python', relevance: 10 } as any);
    vi.mocked(chunkingModule.chunkCodeAst).mockResolvedValue(chunks);
    vi.mocked(embeddingModule.generateEmbeddings).mockResolvedValue(embeddings);

    await indexContentTool.execute(input, defaultOptions);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(hljs.highlightAuto).toHaveBeenCalledWith(input.items[0].content);
    expect(chunkingModule.chunkCodeAst).toHaveBeenCalledWith(
      input.items[0].content,
      SupportedLanguage.Python, // Expect detected language
      input.chunkingOptions,
    );
    expect(embeddingModule.generateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).toHaveBeenCalled();
  });

   it('should use fallback chunking when language detection fails or is unsupported', async () => {
    const input = createValidInput({
      items: [{ content: 'some plain text', source: 'notes.txt' }],
    }); // No language
    const chunks: Chunk[] = [{ id: 'chunk-txt', content: 'some plain text', metadata: {} }];
    const embeddings = [[0.5, 0.6]];

    // Setup mocks
    vi.mocked(hljs.highlightAuto).mockReturnValue({ language: 'unknown', relevance: 0 } as any);
    vi.mocked(chunkingModule.chunkCodeAst).mockResolvedValue(chunks);
    vi.mocked(embeddingModule.generateEmbeddings).mockResolvedValue(embeddings);

    await indexContentTool.execute(input, defaultOptions);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(hljs.highlightAuto).toHaveBeenCalledWith(input.items[0].content);
    expect(chunkingModule.chunkCodeAst).toHaveBeenCalledWith(
      input.items[0].content,
      null, // Expect null language for fallback
      input.chunkingOptions,
    );
    expect(embeddingModule.generateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).toHaveBeenCalled();
  });

  it('should use default configs if not provided', async () => {
    const input = { items: [{ content: 'abc', language: SupportedLanguage.TypeScript }] }; // Minimal input
    const chunks: Chunk[] = [{ id: 'chunk-abc', content: 'abc', metadata: {} }];
    const embeddings = [[0.7, 0.8]];
    const { defaultEmbeddingConfig } = await import('../embedding.js'); // Get default for assertion

    // Setup mocks
    vi.mocked(chunkingModule.chunkCodeAst).mockResolvedValue(chunks);
    vi.mocked(embeddingModule.generateEmbeddings).mockResolvedValue(embeddings);

    await indexContentTool.execute(input, defaultOptions);

    expect(IndexManager.create).toHaveBeenCalledWith({ provider: VectorDbProvider.InMemory }); // Default DB config
    expect(embeddingModule.generateEmbeddings).toHaveBeenCalledWith(expect.any(Array), defaultEmbeddingConfig); // Default embedding config
    expect(chunkingModule.chunkCodeAst).toHaveBeenCalledWith('abc', SupportedLanguage.TypeScript, undefined); // Default chunking options
    expect(mockUpsertItemsInstance).toHaveBeenCalled();
  });

  it('should handle chunking errors gracefully per item', async () => {
    const input = createValidInput();
    const chunkError = new Error('Chunking failed');

    // Setup mocks
    vi.mocked(chunkingModule.chunkCodeAst).mockRejectedValue(chunkError);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings');

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(generateEmbeddingsSpy).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.chunksUpserted).toBe(0);
    expect(itemResult.error).toBe(chunkError.message);
    expect(itemResult.suggestion).toContain('chunking');
  });

  it('should handle embedding errors gracefully per item', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-emb-err', content: 'abc', metadata: {} }];
    const embeddingError = new Error('Embedding failed');

    // Setup mocks
    vi.mocked(chunkingModule.chunkCodeAst).mockResolvedValue(chunks);
    vi.mocked(embeddingModule.generateEmbeddings).mockRejectedValue(embeddingError);

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(embeddingModule.generateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.chunksUpserted).toBe(0);
    expect(itemResult.error).toBe(embeddingError.message);
    expect(itemResult.suggestion).toContain('embedding');
  });

   it('should handle chunk/embedding count mismatch gracefully per item', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [
      { id: 'chunk-mm-1', content: 'abc', metadata: {} },
      { id: 'chunk-mm-2', content: 'def', metadata: {} },
    ]; // 2 chunks
    const embeddings = [[0.1, 0.2]]; // Only 1 embedding

    // Setup mocks
    vi.mocked(chunkingModule.chunkCodeAst).mockResolvedValue(chunks);
    vi.mocked(embeddingModule.generateEmbeddings).mockResolvedValue(embeddings); // Mismatch

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(embeddingModule.generateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.chunksUpserted).toBe(0);
    expect(itemResult.error).toContain('Mismatch between number of chunks and generated embeddings');
    expect(itemResult.suggestion).toContain('unexpected error'); // Default suggestion
  });

  it('should handle index upsert errors gracefully per item', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-upsert-err', content: 'abc', metadata: {} }];
    const embeddings = [[0.1, 0.2]];
    const upsertError = new Error('DB connection failed');

    // Setup mocks
    vi.mocked(chunkingModule.chunkCodeAst).mockResolvedValue(chunks);
    vi.mocked(embeddingModule.generateEmbeddings).mockResolvedValue(embeddings);
    mockUpsertItemsInstance.mockRejectedValue(upsertError); // Make upsert fail

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(embeddingModule.generateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.chunksUpserted).toBe(0);
    expect(itemResult.error).toBe(upsertError.message);
    expect(itemResult.suggestion).toContain('index');
  });

  it('should handle empty input items array', async () => {
    const input = createValidInput({ items: [] });

    // Spy on functions (though they won't be called)
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings');
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst');

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);


    expect(IndexManager.create).toHaveBeenCalled(); // create is still called
    expect(chunkCodeAstSpy).not.toHaveBeenCalled();
    expect(generateEmbeddingsSpy).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(0); // Expect empty results array
  });

  it('should handle items where chunking produces no chunks', async () => {
    const input = createValidInput({
      items: [{ content: '// only comment', language: SupportedLanguage.JavaScript }],
    });

    // Setup mocks
    vi.mocked(chunkingModule.chunkCodeAst).mockResolvedValue([]); // Simulate no chunks
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings');

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(chunkingModule.chunkCodeAst).toHaveBeenCalled();
    expect(generateEmbeddingsSpy).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true); // Success, but 0 chunks
    expect(itemResult.chunksUpserted).toBe(0);
    expect(itemResult.error).toBeUndefined();
  });
});