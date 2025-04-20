// Declare mock variable at the absolute top
const mockUpsertItems = vi.fn();

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { BaseMcpToolOutput, TextPart } from '@sylphlab/mcp-core'; // Import TextPart
import { SupportedLanguage } from '../parsing.js';
import { VectorDbProvider } from '../indexManager.js'; // Import necessary enum/types
import { EmbeddingModelProvider } from '../embedding.js'; // Moved EmbeddingModelProvider import
import { Chunk } from '../types.js';

// --- Mocks ---
const mockChunkCodeAst = vi.fn();
const mockGenerateEmbeddings = vi.fn();
// Remove commented out line
const mockHljsHighlightAuto = vi.fn();

// Mock internal modules
vi.mock('../chunking.js', () => ({
  chunkCodeAst: mockChunkCodeAst,
}));
vi.mock('../embedding.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../embedding.js')>();
  return {
    ...original, // Keep original exports like schemas, defaults
    generateEmbeddings: mockGenerateEmbeddings,
  };
});
vi.mock('../indexManager.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('../indexManager.js')>();
    // Mock the static create method and the instance method
    const mockCreate = vi.fn();
    // Use the top-level mockUpsertItems variable declared outside
    mockCreate.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Correctly reference top-level mock
    return {
        ...original, // Keep original exports like schemas, enums
        IndexManager: {
            create: mockCreate, // Mock the static factory
        },
    };
});

// Mock external dependencies
vi.mock('highlight.js', () => ({
  default: {
    highlightAuto: mockHljsHighlightAuto,
  },
}));

// --- Dynamic Import ---
// Import the tool *after* mocks are set up
import { indexContentTool, IndexContentInputSchema } from './indexContentTool.js';

// --- Test Suite ---
describe('indexContentTool', () => {
  const mockContext = 'test-context'; // Use a string for context

  beforeEach(async () => {
    // Reset mocks
    mockChunkCodeAst.mockReset();
    mockGenerateEmbeddings.mockReset();
    mockUpsertItems?.mockClear(); // Reset the mock if it exists
    mockHljsHighlightAuto.mockReset();
    // Reset IndexManager.create mock if it was used directly
    // Need to await the dynamic import inside beforeEach or access it differently
    const IndexManagerModule = await import('../indexManager.js');
    const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     if (IndexManagerMock && IndexManagerMock.create) {
        IndexManagerMock.create.mockClear();
     }


    // Disable console logging
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore console
  });

  // Helper to create valid input
  const createValidInput = (overrides = {}): z.infer<typeof IndexContentInputSchema> => ({
    items: [{ content: 'const x = 1;', language: SupportedLanguage.JavaScript, source: 'file.js' }],
    chunkingOptions: { maxChunkSize: 100 },
    embeddingConfig: { provider: EmbeddingModelProvider.Ollama, modelName: 'test-model', batchSize: 1 }, // Added batchSize
    vectorDbConfig: { provider: VectorDbProvider.ChromaDB, collectionName: 'test-coll' },
    ...overrides,
  });

  it('should successfully process an item with provided language', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-1', content: 'const x = 1;', metadata: { startLine: 1, endLine: 1 } }]; // Added id
    const embeddings = [[0.1, 0.2]];
    const expectedIndexedItems = [{
        ...chunks[0],
        id: expect.stringContaining('file.js-chunk-0'), // Check for generated ID structure
        vector: embeddings[0],
        metadata: { // Ensure metadata is merged correctly
            ...chunks[0].metadata,
            source: 'file.js',
            language: SupportedLanguage.JavaScript,
            chunkIndex: 0,
        }
    }];

    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);
    mockUpsertItems.mockResolvedValue(undefined); // Simulate successful upsert

    // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution


    const result = await indexContentTool.execute(input, mockContext);

    expect(mockChunkCodeAst).toHaveBeenCalledWith(input.items[0].content, input.items[0].language, input.chunkingOptions);
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(expect.arrayContaining([
         expect.objectContaining({ metadata: expect.objectContaining({ source: 'file.js', language: SupportedLanguage.JavaScript }) })
    ]), input.embeddingConfig);
    expect(mockUpsertItems).toHaveBeenCalledWith(expectedIndexedItems);
    expect(mockHljsHighlightAuto).not.toHaveBeenCalled(); // Language was provided
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 1 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 1 });
  });

  it('should use language detection when language is not provided', async () => {
    const input = createValidInput({ items: [{ content: 'print("hello")', source: 'script.py' }] }); // No language
    const chunks: Chunk[] = [{ id: 'chunk-py', content: 'print("hello")', metadata: {} }]; // Added id
    const embeddings = [[0.3, 0.4]];

     // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution


    mockHljsHighlightAuto.mockReturnValue({ language: 'python', relevance: 10 });
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);
    mockUpsertItems.mockResolvedValue(undefined);

    await indexContentTool.execute(input, mockContext);

    expect(mockHljsHighlightAuto).toHaveBeenCalledWith(input.items[0].content);
    expect(mockChunkCodeAst).toHaveBeenCalledWith(input.items[0].content, SupportedLanguage.Python, input.chunkingOptions); // Expect detected language
    expect(mockGenerateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItems).toHaveBeenCalled();
  });

   it('should use fallback chunking when language detection fails or is unsupported', async () => {
    const input = createValidInput({ items: [{ content: 'some plain text', source: 'notes.txt' }] }); // No language
    const chunks: Chunk[] = [{ id: 'chunk-txt', content: 'some plain text', metadata: {} }]; // Added id
    const embeddings = [[0.5, 0.6]];

     // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution


    mockHljsHighlightAuto.mockReturnValue({ language: 'unknown', relevance: 0 }); // Simulate failed detection
    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);
    mockUpsertItems.mockResolvedValue(undefined);

    await indexContentTool.execute(input, mockContext);

    expect(mockHljsHighlightAuto).toHaveBeenCalledWith(input.items[0].content);
    expect(mockChunkCodeAst).toHaveBeenCalledWith(input.items[0].content, null, input.chunkingOptions); // Expect null language for fallback
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("language 'unknown' not mapped"));
    expect(mockGenerateEmbeddings).toHaveBeenCalled();
    expect(mockUpsertItems).toHaveBeenCalled();
  });

  it('should use default configs if not provided', async () => {
    const input = { items: [{ content: 'abc', language: SupportedLanguage.TypeScript }] }; // Minimal input
    const chunks: Chunk[] = [{ id: 'chunk-abc', content: 'abc', metadata: {} }]; // Added id
    const embeddings = [[0.7, 0.8]];
    const { defaultEmbeddingConfig } = await import('../embedding.js'); // Get default for assertion

     // Mock IndexManager.create resolution and capture call
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution


    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);
    mockUpsertItems.mockResolvedValue(undefined);


    await indexContentTool.execute(input, mockContext);

    expect(IndexManagerMock.create).toHaveBeenCalledWith({ provider: VectorDbProvider.InMemory }); // Default DB config
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(expect.any(Array), defaultEmbeddingConfig); // Default embedding config
    expect(mockChunkCodeAst).toHaveBeenCalledWith('abc', SupportedLanguage.TypeScript, undefined); // Default chunking options
  });

  it('should handle chunking errors gracefully', async () => {
    const input = createValidInput();
    const chunkError = new Error('Chunking failed');

     // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution

    mockChunkCodeAst.mockRejectedValue(chunkError);

    const result = await indexContentTool.execute(input, mockContext);

    expect(mockGenerateEmbeddings).not.toHaveBeenCalled();
    expect(mockUpsertItems).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error chunking content'), expect.stringContaining(chunkError.message));
    // Should still report success overall, but with 0 items upserted
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 0 chunks'); // Assert type
     expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 0 });
  });

  it('should handle embedding errors gracefully', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-emb-err', content: 'abc', metadata: {} }]; // Added id
    const embeddingError = new Error('Embedding failed');

     // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution


    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockRejectedValue(embeddingError);

    const result = await indexContentTool.execute(input, mockContext);

    expect(mockUpsertItems).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error generating embeddings'), expect.stringContaining(embeddingError.message));
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 0 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 0 });
  });

   it('should handle chunk/embedding count mismatch', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-mm-1', content: 'abc', metadata: {} }, { id: 'chunk-mm-2', content: 'def', metadata: {} }]; // 2 chunks, Added ids
    const embeddings = [[0.1, 0.2]]; // Only 1 embedding

     // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution


    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings); // Mismatch

    const result = await indexContentTool.execute(input, mockContext);

    expect(mockUpsertItems).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Mismatch between chunk count (2) and embedding count (1)'));
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 0 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 0 });
  });


  it('should handle index upsert errors', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-upsert-err', content: 'abc', metadata: {} }]; // Added id
    const embeddings = [[0.1, 0.2]];
    const upsertError = new Error('DB connection failed');

     // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution


    mockChunkCodeAst.mockResolvedValue(chunks);
    mockGenerateEmbeddings.mockResolvedValue(embeddings);
    mockUpsertItems.mockRejectedValue(upsertError); // Simulate upsert failure

    const result = await indexContentTool.execute(input, mockContext);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error upserting items'), expect.stringContaining(upsertError.message));
    expect(result.success).toBe(false);
    expect((result.content[0] as TextPart).text).toContain(`Error upserting items into index: ${upsertError.message}`); // Assert type
  });

   it('should handle empty input items array', async () => {
    const input = createValidInput({ items: [] });

     // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution


    const result = await indexContentTool.execute(input, mockContext);

    expect(mockChunkCodeAst).not.toHaveBeenCalled();
    expect(mockGenerateEmbeddings).not.toHaveBeenCalled();
    expect(mockUpsertItems).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 0 items. Upserted 0 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 0, upsertedChunkCount: 0 });
  });

   it('should handle items where chunking produces no chunks', async () => {
    const input = createValidInput({ items: [{ content: '// only comment', language: SupportedLanguage.JavaScript }] });

     // Mock IndexManager.create resolution
     const IndexManagerModule = await import('../indexManager.js');
     const IndexManagerMock = vi.mocked(IndexManagerModule.IndexManager);
     IndexManagerMock.create.mockResolvedValue({ upsertItems: mockUpsertItems } as any); // Cast mock resolution

    mockChunkCodeAst.mockResolvedValue([]); // Simulate no chunks generated

    const result = await indexContentTool.execute(input, mockContext);

    expect(mockChunkCodeAst).toHaveBeenCalled();
    expect(mockGenerateEmbeddings).not.toHaveBeenCalled();
    expect(mockUpsertItems).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No chunks generated'));
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 0 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 0 });
  });

});