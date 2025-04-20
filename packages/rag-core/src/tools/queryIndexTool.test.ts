import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { z } from 'zod';
// Import the actual modules now, except for embedding which we still mock fully
import { queryIndexTool, QueryIndexInputSchema } from './queryIndexTool.js';
import { IndexManager, VectorDbProvider, QueryResult, VectorDbConfigSchema } from '../indexManager.js';
import * as embedding from '../embedding.js'; // Mocked below
import { BaseMcpToolOutput } from '@sylphlab/mcp-core';

// --- Mock Setup ---

// 1. Define the mock function needed for the instance
const mockQueryIndex = vi.fn<any[], Promise<QueryResult[]>>();

// 2. Mock embedding.js fully (as before)
vi.mock('../embedding.js', async (importOriginal) => {
    const original = await importOriginal() as typeof embedding;
    return {
        ...original,
        generateEmbeddings: vi.fn(),
        OllamaEmbeddingFunction: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
        HttpEmbeddingFunction: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
        MockEmbeddingFunction: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
    };
});

// 3. Get reference to mocked embedding function
const mockGenerateEmbeddings = vi.mocked(embedding.generateEmbeddings);

// --- Test Suite ---

import { MockInstance } from 'vitest'; // Import MockInstance

describe('queryIndexTool', () => {
  // Declare spy variable without explicit type; let it be inferred in beforeEach
  let MockIndexManagerCreate;

  beforeEach(() => {
    // Reset all mocks (including spies)
    vi.restoreAllMocks(); // Use restoreAllMocks with spyOn

    // Define the instance we want create() to resolve to
    const mockInstance = { queryIndex: mockQueryIndex }; // Define only once

    // Assign the spy in beforeEach
    MockIndexManagerCreate = vi.spyOn(IndexManager, 'create').mockResolvedValue(mockInstance as any);

    // Set default behaviors for other mocks
    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockQueryIndex.mockResolvedValue([
        { item: { id: 'res1', content: 'Result 1 content', vector: [1], metadata: { source: 'file1.txt' } }, score: 0.9 },
        { item: { id: 'res2', content: 'Result 2 content', vector: [2], metadata: { source: 'file2.txt' } }, score: 0.8 },
    ]);
  });

  // Optional: Ensure spies are restored after all tests in the suite
  // afterEach(() => {
  //   vi.restoreAllMocks();
  // });

  it('should successfully query with default settings', async () => {
    const input = { queryText: 'test query', topK: 5 };
    const result = await queryIndexTool.execute(input, { workspacePath: '.' });

    expect(result.success).toBe(true);
    expect(mockGenerateEmbeddings).toHaveBeenCalledOnce();
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith([input.queryText], embedding.defaultEmbeddingConfig);
    expect(MockIndexManagerCreate).toHaveBeenCalledOnce();
    expect(MockIndexManagerCreate).toHaveBeenCalledWith(
        { provider: VectorDbProvider.InMemory }, // Use original enum
        expect.any(embedding.MockEmbeddingFunction)
    );
    expect(mockQueryIndex).toHaveBeenCalledOnce();
    expect(mockQueryIndex).toHaveBeenCalledWith([0.1, 0.2, 0.3], 5, undefined);
    expect(result.content).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'text', text: expect.stringContaining('Found 2 relevant results') }),
        expect.objectContaining({ type: 'text', text: expect.stringContaining('Result 1 content') }),
        expect.objectContaining({ type: 'text', text: expect.stringContaining('Result 2 content') }),
    ]));
    expect(result.data?.results).toHaveLength(2);
  });

  it('should handle embedding generation failure', async () => {
     const input = { queryText: 'fail embedding', topK: 5 };
     const error = new Error('Embedding failed');
     mockGenerateEmbeddings.mockRejectedValue(error);

     const result = await queryIndexTool.execute(input, { workspacePath: '.' });

     expect(result.success).toBe(false);
     expect(result.content).toEqual([{ type: 'text', text: `Error generating query embedding: ${error.message}` }]);
     expect(MockIndexManagerCreate).not.toHaveBeenCalled();
     expect(mockQueryIndex).not.toHaveBeenCalled();
  });

  it('should handle IndexManager creation failure', async () => {
      const input = { queryText: 'fail manager create', topK: 5 };
      const error = new Error('Manager creation failed');
      // Re-mock the spy for this specific test case
      MockIndexManagerCreate.mockRejectedValue(error);

      const result = await queryIndexTool.execute(input, { workspacePath: '.' });

      expect(result.success).toBe(false);
      expect(result.content).toEqual([{ type: 'text', text: `Error querying index: ${error.message}` }]);
      expect(mockGenerateEmbeddings).toHaveBeenCalledOnce();
      expect(mockQueryIndex).not.toHaveBeenCalled();
  });

   it('should handle index query failure', async () => {
      const input = { queryText: 'fail query', topK: 5 };
      const error = new Error('Query failed');
      mockQueryIndex.mockRejectedValue(error); // Configure the query mock

      const result = await queryIndexTool.execute(input, { workspacePath: '.' });

      expect(result.success).toBe(false);
      expect(result.content).toEqual([{ type: 'text', text: `Error querying index: ${error.message}` }]);
      expect(mockGenerateEmbeddings).toHaveBeenCalledOnce();
      expect(MockIndexManagerCreate).toHaveBeenCalledOnce();
      expect(mockQueryIndex).toHaveBeenCalledOnce();
  });

  it('should handle no results found', async () => {
      const input = { queryText: 'no results query', topK: 5 };
      mockQueryIndex.mockResolvedValue([]); // Configure the query mock

      const result = await queryIndexTool.execute(input, { workspacePath: '.' });

      expect(result.success).toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: 'No relevant results found in the index.' }]);
      expect(result.data?.results).toHaveLength(0);
      expect(mockGenerateEmbeddings).toHaveBeenCalledOnce();
      expect(MockIndexManagerCreate).toHaveBeenCalledOnce();
      expect(mockQueryIndex).toHaveBeenCalledOnce();
  });

  it('should pass filter and topK to queryIndex', async () => {
      const input = {
          queryText: 'query with filter',
          topK: 3,
          filter: { source: 'specific_file.txt', year: 2024 }
      };
      const queryVector = [0.5, 0.5];
      mockGenerateEmbeddings.mockResolvedValue([queryVector]);

      await queryIndexTool.execute(input, { workspacePath: '.' });

      expect(mockQueryIndex).toHaveBeenCalledOnce();
      expect(mockQueryIndex).toHaveBeenCalledWith(queryVector, input.topK, input.filter);
  });

  it('should use provided embedding and vector DB configs', async () => {
      const ollamaConfig: Extract<z.infer<typeof embedding.EmbeddingModelConfigSchema>, { provider: embedding.EmbeddingModelProvider.Ollama }> = {
          provider: embedding.EmbeddingModelProvider.Ollama,
          modelName: 'custom-ollama',
          baseURL: 'http://custom:11434',
          batchSize: 100
      };
      // Use the original VectorDbConfigSchema imported at the top
      const chromaConfig: Extract<z.infer<typeof VectorDbConfigSchema>, { provider: VectorDbProvider.ChromaDB }> = {
          provider: VectorDbProvider.ChromaDB,
          collectionName: 'custom-chroma',
          host: 'http://custom-chroma:8000'
      };
      const input = {
          queryText: 'custom config query',
          topK: 5,
          embeddingConfig: ollamaConfig,
          vectorDbConfig: chromaConfig
      };
      const queryVector = [0.9, 0.1];
      mockGenerateEmbeddings.mockResolvedValue([queryVector]);

      await queryIndexTool.execute(input, { workspacePath: '.' });

      expect(mockGenerateEmbeddings).toHaveBeenCalledWith([input.queryText], input.embeddingConfig);
      expect(MockIndexManagerCreate).toHaveBeenCalledWith(
          input.vectorDbConfig,
          expect.any(embedding.OllamaEmbeddingFunction)
      );
      expect(embedding.OllamaEmbeddingFunction).toHaveBeenCalledWith('custom-ollama', 'http://custom:11434');
      expect(mockQueryIndex).toHaveBeenCalledWith(queryVector, 5, undefined);
  });

});