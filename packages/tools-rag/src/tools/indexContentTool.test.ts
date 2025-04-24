import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Import Part and ToolExecuteOptions
import hljs from 'highlight.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import * as chunkingModule from '../chunking.js';
import { EmbeddingModelProvider } from '../embedding.js';
import * as embeddingModule from '../embedding.js';
// Import IndexManager and VectorDbProvider normally
import { IndexManager, VectorDbProvider } from '../indexManager.js';
import { SupportedLanguage } from '../parsing.js';
import type { Chunk } from '../types.js';
import { type IndexContentInputSchema, type IndexContentToolInput, indexContentTool } from './indexContentTool.js'; // Added IndexContentToolInput type import
import type { IndexContentResultItem } from './indexContentTool.js'; // Import correct result type

// --- Mocks ---
// Mock modules whose functions we need to spy on or replace
vi.mock('../chunking.js');
vi.mock('../embedding.js');
// DO NOT mock '../indexManager.js' at the top level, as it interferes with Zod schema import
vi.mock('highlight.js');

// Mock the default export and named exports for embedding
vi.mock('../embedding.js', async (importOriginal) => {
  const actual = await importOriginal<typeof embeddingModule>();
  return {
    ...actual, // Keep actual exports like EmbeddingModelProvider
    generateEmbeddings: vi.fn(), // Mock the function
    defaultEmbeddingConfig: actual.defaultEmbeddingConfig, // Keep the actual default config
  };
});

// Define the mock function for the instance method BEFORE describe block
const mockUpsertItemsInstance = vi.fn();

const defaultOptions: ToolExecuteOptions = { workspaceRoot: '/test/workspace' };

// Helper to extract JSON result from parts
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  const jsonPart = parts.find(part => part.type === 'json');
  if (jsonPart && jsonPart.value !== undefined) {
    try {
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  return undefined;
}

describe('indexContentTool', () => {
  // Get typed references to mocked functions AFTER vi.mock calls
  const mockChunkCodeAst = vi.mocked(chunkingModule.chunkCodeAst);
  const mockGenerateEmbeddings = vi.mocked(embeddingModule.generateEmbeddings);
  const mockHighlightAuto = vi.mocked(hljs.highlightAuto);
  // We will mock IndexManager.create in beforeEach

  beforeEach(() => {
    vi.resetAllMocks(); // Reset all mocks

    // Mock the static create method HERE to avoid hoisting issues with schema imports
    vi.spyOn(IndexManager, 'create').mockResolvedValue({
        upsertItems: mockUpsertItemsInstance,
    } as any);

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
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult<IndexContentResultItem>(parts); // Added type argument

    expect(IndexManager.create).toHaveBeenCalledWith(input.vectorDbConfig);
    expect(mockChunkCodeAst).toHaveBeenCalledWith(
      input.items[0].content,
      input.items[0].language,
      input.chunkingOptions,
    );
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(
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
    expect(mockHighlightAuto).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.chunksUpserted).toBe(1); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
  });

  it('should use language detection when language is not provided', async () => {
    const input = createValidInput({ items: [{ content: 'print("hello")', source: 'script.py' }] }); // No language
    const chunks: Chunk[] = [{ id: 'chunk-py', content: 'print("hello")', metadata: {} }];
    const embeddings = [[0.3, 0.4]];

    // Setup mocks
    mockHighlightAuto.mockReturnValue({ language: 'python', relevance: 10 } as any);
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);

    await indexContentTool.execute(input, defaultOptions);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(mockHighlightAuto).toHaveBeenCalledWith(input.items[0].content);
    expect(mockChunkCodeAst).toHaveBeenCalledWith(
      input.items[0].content,
      SupportedLanguage.Python, // Expect detected language
      input.chunkingOptions,
    );
    expect(mockGenerateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).toHaveBeenCalled();
  });

   it('should use fallback chunking when language detection fails or is unsupported', async () => {
    const input = createValidInput({
      items: [{ content: 'some plain text', source: 'notes.txt' }],
    }); // No language
    const chunks: Chunk[] = [{ id: 'chunk-txt', content: 'some plain text', metadata: {} }];
    const embeddings = [[0.5, 0.6]];

    // Setup mocks
    mockHighlightAuto.mockReturnValue({ language: 'unknown', relevance: 0 } as any);
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);

    await indexContentTool.execute(input, defaultOptions);

    expect(IndexManager.create).toHaveBeenCalled();
    expect(mockHighlightAuto).toHaveBeenCalledWith(input.items[0].content);
    expect(mockChunkCodeAst).toHaveBeenCalledWith(
      input.items[0].content,
      null, // Expect null language for fallback
      input.chunkingOptions,
    );
    expect(mockGenerateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).toHaveBeenCalled();
  });

  it('should use default configs if not provided', async () => {
    // Provide a valid minimal input according to the schema
    const input: Partial<IndexContentToolInput> = { items: [{ content: 'abc', language: SupportedLanguage.TypeScript }] };
    const chunks: Chunk[] = [{ id: 'chunk-abc', content: 'abc', metadata: {} }];
    const embeddings = [[0.7, 0.8]];
    const { defaultEmbeddingConfig } = await import('../embedding.js'); // Get default for assertion

    // Setup mocks
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);

    // Use 'as any' for input if it doesn't perfectly match the full type initially
    await indexContentTool.execute(input as IndexContentToolInput, defaultOptions);

    expect(IndexManager.create).toHaveBeenCalledWith({ provider: VectorDbProvider.InMemory }); // Default DB config
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(expect.any(Array), defaultEmbeddingConfig); // Default embedding config
    expect(mockChunkCodeAst).toHaveBeenCalledWith('abc', SupportedLanguage.TypeScript, undefined); // Default chunking options
    expect(mockUpsertItemsInstance).toHaveBeenCalled();
  });

  it('should handle chunking errors gracefully per item', async () => {
    const input = createValidInput();
    const chunkError = new Error('Chunking failed');

    // Setup mocks
    mockChunkCodeAst.mockRejectedValue(chunkError);

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult<IndexContentResultItem>(parts); // Added type argument

    expect(IndexManager.create).toHaveBeenCalled();
    expect(mockGenerateEmbeddings).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.chunksUpserted).toBe(0); // Added optional chaining
    expect(itemResult?.error).toBe(chunkError.message); // Added optional chaining
    expect(itemResult?.suggestion).toContain('chunking'); // Added optional chaining
  });

  it('should handle embedding errors gracefully per item', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-emb-err', content: 'abc', metadata: {} }];
    const embeddingError = new Error('Embedding failed');

    // Setup mocks
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockRejectedValue(embeddingError);

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult<IndexContentResultItem>(parts); // Added type argument

    expect(IndexManager.create).toHaveBeenCalled();
    expect(mockGenerateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.chunksUpserted).toBe(0); // Added optional chaining
    expect(itemResult?.error).toBe(embeddingError.message); // Added optional chaining
    expect(itemResult?.suggestion).toContain('embedding'); // Added optional chaining
  });

   it('should handle chunk/embedding count mismatch gracefully per item', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [
      { id: 'chunk-mm-1', content: 'abc', metadata: {} },
      { id: 'chunk-mm-2', content: 'def', metadata: {} },
    ]; // 2 chunks
    const embeddings = [[0.1, 0.2]]; // Only 1 embedding

    // Setup mocks
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings); // Mismatch

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult<IndexContentResultItem>(parts); // Added type argument

    expect(IndexManager.create).toHaveBeenCalled();
    expect(mockGenerateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.chunksUpserted).toBe(0); // Added optional chaining
    expect(itemResult?.error).toContain('Mismatch between number of chunks and generated embeddings'); // Added optional chaining
    expect(itemResult?.suggestion).toContain('Check embedding model configuration'); // Corrected suggestion check
  });

  it('should handle index upsert errors gracefully per item', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-upsert-err', content: 'abc', metadata: {} }];
    const embeddings = [[0.1, 0.2]];
    const upsertError = new Error('DB connection failed');

    // Setup mocks
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);
    mockUpsertItemsInstance.mockRejectedValue(upsertError); // Make upsert fail

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult<IndexContentResultItem>(parts); // Added type argument

    expect(IndexManager.create).toHaveBeenCalled();
    expect(mockGenerateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.chunksUpserted).toBe(0); // Added optional chaining
    expect(itemResult?.error).toBe(upsertError.message); // Added optional chaining
    expect(itemResult?.suggestion).toContain('An unexpected error occurred during processing.'); // Corrected suggestion check
  });

  it('should handle empty input items array', async () => {
    const input = createValidInput({ items: [] });

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult<IndexContentResultItem>(parts); // Added type argument


    expect(IndexManager.create).toHaveBeenCalled(); // create is still called
    expect(mockChunkCodeAst).not.toHaveBeenCalled();
    expect(mockGenerateEmbeddings).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(0); // Expect empty results array
  });

  it('should handle items where chunking produces no chunks', async () => {
    const input = createValidInput({
      items: [{ content: '// only comment', language: SupportedLanguage.JavaScript }],
    });

    // Setup mocks
    mockChunkCodeAst.mockResolvedValue([]); // Simulate no chunks

    const parts = await indexContentTool.execute(input, defaultOptions);
    const results = getJsonResult<IndexContentResultItem>(parts); // Added type argument

    expect(IndexManager.create).toHaveBeenCalled();
    expect(mockChunkCodeAst).toHaveBeenCalled();
    expect(mockGenerateEmbeddings).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining // Success, but 0 chunks
    expect(itemResult?.chunksUpserted).toBe(0); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
  });
});