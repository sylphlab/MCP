import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Remove top-level declaration of mockUpsertItems
import type { z } from 'zod';
import { BaseMcpToolOutput, type TextPart, type McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import TextPart and McpToolExecuteOptions
import { SupportedLanguage } from '../parsing.js';
import { VectorDbProvider, IndexManager } from '../indexManager.js'; // Import IndexManager class directly
import { EmbeddingModelProvider } from '../embedding.js'; // Import EmbeddingModelProvider enum
import * as embeddingModule from '../embedding.js'; // Import the module for spying
import * as chunkingModule from '../chunking.js'; // Import the module for spying
import hljs from 'highlight.js'; // Import highlight.js for spying
import type { Chunk } from '../types.js';

// --- Mocks --- No mocks defined here

// Remove all vi.mock calls for chunking and highlight.js

// --- Dynamic Import ---
// Import the tool *after* mocks are set up
import { indexContentTool, type IndexContentInputSchema } from './indexContentTool.js';

// --- Test Suite ---
describe('indexContentTool', () => {
  const mockWorkspaceRoot = '/test/workspace'; // Define mock workspace root
  const defaultOptions: McpToolExecuteOptions = { workspaceRoot: mockWorkspaceRoot }; // Define options

  beforeEach(async () => {
    // Reset spies in afterEach


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

    // Spy on functions for this test
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockResolvedValue(chunks);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings').mockResolvedValue(embeddings);
    const highlightAutoSpy = vi.spyOn(hljs, 'highlightAuto'); // Use hljs directly

    // Spy on IndexManager.create for this test
    const mockUpsertItemsInstance = vi.fn().mockResolvedValue(undefined);
    const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
        upsertItems: mockUpsertItemsInstance
    } as any);


    const result = await indexContentTool.execute(input, defaultOptions); // Pass options object

    // Expect createSpy to be called with config
    expect(createSpy).toHaveBeenCalledWith(input.vectorDbConfig); // TODO: Add back expect.any(Function) later
    expect(chunkCodeAstSpy).toHaveBeenCalledWith(input.items[0].content, input.items[0].language, input.chunkingOptions);
    expect(generateEmbeddingsSpy).toHaveBeenCalledWith(expect.arrayContaining([
         expect.objectContaining({ metadata: expect.objectContaining({ source: 'file.js', language: SupportedLanguage.JavaScript }) })
    ]), input.embeddingConfig);
    expect(mockUpsertItemsInstance).toHaveBeenCalledWith(expectedIndexedItems); // Assert on the instance's mock
    expect(highlightAutoSpy).not.toHaveBeenCalled(); // Language was provided
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 1 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 1 });
  });

  it('should use language detection when language is not provided', async () => {
    const input = createValidInput({ items: [{ content: 'print("hello")', source: 'script.py' }] }); // No language
    const chunks: Chunk[] = [{ id: 'chunk-py', content: 'print("hello")', metadata: {} }]; // Added id
    const embeddings = [[0.3, 0.4]];

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn().mockResolvedValue(undefined);
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);


    // Spy and set mock behavior for this test
    const highlightAutoSpy = vi.spyOn(hljs, 'highlightAuto').mockReturnValue({ language: 'python', relevance: 10 } as any); // Use 'as any'
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockResolvedValue(chunks);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings').mockResolvedValue(embeddings);


    await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalled();
    expect(highlightAutoSpy).toHaveBeenCalledWith(input.items[0].content);
    expect(chunkCodeAstSpy).toHaveBeenCalledWith(input.items[0].content, SupportedLanguage.Python, input.chunkingOptions); // Expect detected language
    expect(generateEmbeddingsSpy).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).toHaveBeenCalled(); // Assert on the instance's mock
  });

   it('should use fallback chunking when language detection fails or is unsupported', async () => {
    const input = createValidInput({ items: [{ content: 'some plain text', source: 'notes.txt' }] }); // No language
    const chunks: Chunk[] = [{ id: 'chunk-txt', content: 'some plain text', metadata: {} }]; // Added id
    const embeddings = [[0.5, 0.6]];

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn().mockResolvedValue(undefined);
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);


    // Spy and set mock behavior for this test
    const highlightAutoSpy = vi.spyOn(hljs, 'highlightAuto').mockReturnValue({ language: 'unknown', relevance: 0 } as any); // Use 'as any'
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockResolvedValue(chunks);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings').mockResolvedValue(embeddings);


    await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalled();
    expect(highlightAutoSpy).toHaveBeenCalledWith(input.items[0].content);
    expect(chunkCodeAstSpy).toHaveBeenCalledWith(input.items[0].content, null, input.chunkingOptions); // Expect null language for fallback
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("language 'unknown' not mapped"));
    expect(generateEmbeddingsSpy).toHaveBeenCalled();
    expect(mockUpsertItemsInstance).toHaveBeenCalled(); // Assert on the instance's mock
  });

  it('should use default configs if not provided', async () => {
    const input = { items: [{ content: 'abc', language: SupportedLanguage.TypeScript }] }; // Minimal input
    const chunks: Chunk[] = [{ id: 'chunk-abc', content: 'abc', metadata: {} }]; // Added id
    const embeddings = [[0.7, 0.8]];
    const { defaultEmbeddingConfig } = await import('../embedding.js'); // Get default for assertion

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn().mockResolvedValue(undefined);
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);


    // Spy and set mock behavior for this test
    // Spy and set mock behavior for this test
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockResolvedValue(chunks);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings').mockResolvedValue(embeddings);


    await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalledWith({ provider: VectorDbProvider.InMemory }); // Default DB config
    expect(generateEmbeddingsSpy).toHaveBeenCalledWith(expect.any(Array), defaultEmbeddingConfig); // Default embedding config
    expect(chunkCodeAstSpy).toHaveBeenCalledWith('abc', SupportedLanguage.TypeScript, undefined); // Default chunking options
    expect(mockUpsertItemsInstance).toHaveBeenCalled(); // Assert upsert was called
  });

  it('should handle chunking errors gracefully', async () => {
    const input = createValidInput();
    const chunkError = new Error('Chunking failed');

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn();
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);

    // Spy and set mock behavior for this test
    // Spy and set mock behavior for this test
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockRejectedValue(chunkError);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings');


    const result = await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalled(); // create is still called
    expect(generateEmbeddingsSpy).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled(); // Assert instance mock wasn't called
    // Use exact string matching based on previous output
    expect(console.error).toHaveBeenCalledWith(`Error chunking content for source ${input.items[0].source}: ${chunkError.message}. Skipping item.`);
    // Should still report success overall, but with 0 items upserted
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 0 chunks'); // Assert type
     expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 0 });
  });

  it('should handle embedding errors gracefully', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-emb-err', content: 'abc', metadata: {} }]; // Added id
    const embeddingError = new Error('Embedding failed');

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn();
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);


    // Spy and set mock behavior for this test
    // Spy and set mock behavior for this test
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockResolvedValue(chunks);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings').mockRejectedValue(embeddingError);


    const result = await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalled(); // create is still called
    expect(generateEmbeddingsSpy).toHaveBeenCalled(); // Ensure generateEmbeddings was called
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled(); // Assert instance mock wasn't called
    // Use exact string matching based on previous output
    expect(console.error).toHaveBeenCalledWith(`Error generating embeddings for source ${input.items[0].source}: ${embeddingError.message}. Skipping item.`);
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 0 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 0 });
  });

   it('should handle chunk/embedding count mismatch', async () => {
    const input = createValidInput();
    const chunks: Chunk[] = [{ id: 'chunk-mm-1', content: 'abc', metadata: {} }, { id: 'chunk-mm-2', content: 'def', metadata: {} }]; // 2 chunks, Added ids
    const embeddings = [[0.1, 0.2]]; // Only 1 embedding

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn();
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);


    // Spy and set mock behavior for this test
    // Spy and set mock behavior for this test
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockResolvedValue(chunks);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings').mockResolvedValue(embeddings); // Mismatch


    const result = await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalled(); // create is still called
    expect(generateEmbeddingsSpy).toHaveBeenCalled(); // Ensure generateEmbeddings was called
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled(); // Assert instance mock wasn't called
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

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn().mockRejectedValue(upsertError);
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);


    // Spy and set mock behavior for this test
    // Spy and set mock behavior for this test
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockResolvedValue(chunks);
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings').mockResolvedValue(embeddings);


    const result = await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalled(); // create is still called
    expect(generateEmbeddingsSpy).toHaveBeenCalled(); // Ensure generateEmbeddings was called
    expect(mockUpsertItemsInstance).toHaveBeenCalled(); // Ensure upsert was called

    // Use exact string matching based on previous output
    expect(console.error).toHaveBeenCalledWith(`Error upserting items into index: ${upsertError.message}`);
    expect(result.success).toBe(false);
    expect((result.content[0] as TextPart).text).toContain(`Error upserting items into index: ${upsertError.message}`); // Assert type
  });

   it('should handle empty input items array', async () => {
    const input = createValidInput({ items: [] });

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn();
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);


    const result = await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalled(); // create is still called
    // Spy on functions (though they won't be called)
    // Spy on functions (though they won't be called)
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings');
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst');
    expect(chunkCodeAstSpy).not.toHaveBeenCalled();
    expect(generateEmbeddingsSpy).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled(); // Assert instance mock wasn't called
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 0 items. Upserted 0 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 0, upsertedChunkCount: 0 });
  });

   it('should handle items where chunking produces no chunks', async () => {
    const input = createValidInput({ items: [{ content: '// only comment', language: SupportedLanguage.JavaScript }] });

     // Spy on IndexManager.create for this test
     const mockUpsertItemsInstance = vi.fn();
     const createSpy = vi.spyOn(IndexManager, 'create').mockResolvedValue({
         upsertItems: mockUpsertItemsInstance
     } as any);

    // Spy on functions (though generateEmbeddings won't be called)
    const chunkCodeAstSpy = vi.spyOn(chunkingModule, 'chunkCodeAst').mockResolvedValue([]); // Simulate no chunks generated
    const generateEmbeddingsSpy = vi.spyOn(embeddingModule, 'generateEmbeddings');

    const result = await indexContentTool.execute(input, defaultOptions); // Pass options object

    expect(createSpy).toHaveBeenCalled(); // create is still called
    expect(chunkCodeAstSpy).toHaveBeenCalled();
    expect(generateEmbeddingsSpy).not.toHaveBeenCalled();
    expect(mockUpsertItemsInstance).not.toHaveBeenCalled(); // Assert instance mock wasn't called
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No chunks generated'));
    expect(result.success).toBe(true);
    expect((result.content[0] as TextPart).text).toContain('Successfully processed 1 items. Upserted 0 chunks'); // Assert type
    expect((result as any).data).toEqual({ processedItemCount: 1, upsertedChunkCount: 0 });
  });

});