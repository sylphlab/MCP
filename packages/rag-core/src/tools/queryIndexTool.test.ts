import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part and ToolExecuteOptions
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import * as embedding from '../embedding.js';
import { EmbeddingModelProvider } from '../embedding.js'; // Import enum itself
import {
  IndexManager,
  type QueryResult, // Keep QueryResult type
  type VectorDbConfig,
  VectorDbProvider,
} from '../indexManager.js';
import { QueryIndexInputSchema, queryIndexTool } from './queryIndexTool.js';
import type { QueryIndexResult } from './queryIndexTool.js'; // Import correct result type

// --- Mock Setup ---

// 1. Define the mock function needed for the instance
const mockQueryIndex = vi.fn<any[], Promise<QueryResult[]>>();

// 2. Mock embedding.js fully (as before)
vi.mock('../embedding.js', async (importOriginal) => {
  const original = (await importOriginal()) as typeof embedding;
  return {
    ...original,
    generateEmbeddings: vi.fn(),
    OllamaEmbeddingFunction: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
    HttpEmbeddingFunction: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
    MockEmbeddingFunction: vi.fn().mockImplementation(() => ({ generate: vi.fn() })),
  };
});

// 3. Mock IndexManager specifically for the static create method
vi.mock('../indexManager.js', async (importOriginal) => {
    const actual = await importOriginal() as typeof import('../indexManager.js');
    return {
        ...actual, // Keep original exports like VectorDbProvider
        IndexManager: {
            ...actual.IndexManager,
            create: vi.fn(), // Mock the static create method
        },
    };
});

// 4. Get reference to mocked functions/methods
const mockGenerateEmbeddings = vi.mocked(embedding.generateEmbeddings);
const MockIndexManagerCreate = vi.mocked(IndexManager.create);

// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  // console.log('DEBUG: getJsonResult received parts:', JSON.stringify(parts, null, 2)); // Keep commented for now
  const jsonPart = parts.find(part => part.type === 'json');
  // console.log('DEBUG: Found jsonPart:', JSON.stringify(jsonPart, null, 2)); // Keep commented for now
  // Check if jsonPart exists and has a 'value' property (which holds the actual data)
  if (jsonPart && jsonPart.value !== undefined) {
    // console.log('DEBUG: typeof jsonPart.value:', typeof jsonPart.value); // Keep commented for now
    // console.log('DEBUG: Attempting to use jsonPart.value directly'); // Keep commented for now
    try {
      // Assuming the value is already the correct array type based on defineTool's outputSchema
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  // Removed extra closing brace
  return undefined;
}

const mockWorkspaceRoot = '/test/workspace';
// Corrected variable name from _defaultOptions to defaultOptions
const defaultOptions: ToolExecuteOptions = { workspaceRoot: mockWorkspaceRoot };

describe('queryIndexTool', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock the instance method needed for the test
    const mockInstance = { queryIndex: mockQueryIndex };
    // Ensure the static create mock resolves with the instance containing the mocked method
    MockIndexManagerCreate.mockResolvedValue(mockInstance as any);

    // Set default behaviors for other mocks
    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockQueryIndex.mockResolvedValue([
      {
        item: {
          id: 'res1',
          content: 'Result 1 content',
          vector: [1],
          metadata: { source: 'file1.txt' },
        },
        score: 0.9,
      },
      {
        item: {
          id: 'res2',
          content: 'Result 2 content',
          vector: [2],
          metadata: { source: 'file2.txt' },
        },
        score: 0.8,
      },
    ]);
  });

  afterEach(() => {
      vi.restoreAllMocks();
  });

  it('should successfully query with default settings', async () => {
    const input = { queryText: 'test query', topK: 5 };
    const parts = await queryIndexTool.execute(input, defaultOptions);
    const results = getJsonResult<QueryIndexResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];

    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.query).toBe('test query'); // Added optional chaining
    expect(itemResult?.results).toHaveLength(2); // Added optional chaining
    expect(itemResult?.results[0].item.id).toBe('res1'); // Added optional chaining
    expect(itemResult?.results[1].item.id).toBe('res2'); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining

    expect(mockGenerateEmbeddings).toHaveBeenCalledOnce();
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(
      [input.queryText],
      embedding.defaultEmbeddingConfig,
    );
    expect(MockIndexManagerCreate).toHaveBeenCalledOnce();
    expect(MockIndexManagerCreate).toHaveBeenCalledWith(
      { provider: VectorDbProvider.InMemory },
      expect.any(embedding.MockEmbeddingFunction),
    );
    expect(mockQueryIndex).toHaveBeenCalledOnce();
    expect(mockQueryIndex).toHaveBeenCalledWith([0.1, 0.2, 0.3], 5, undefined);
  });

  it('should handle embedding generation failure', async () => {
    // Corrected variable name
    const input = { queryText: 'fail embedding', topK: 5 };
    // Corrected variable name
    const error = new Error('Embedding failed');
    mockGenerateEmbeddings.mockRejectedValue(error);

    const parts = await queryIndexTool.execute(input, defaultOptions);
    const results = getJsonResult<QueryIndexResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    // Error message might be wrapped, check containment
    expect(itemResult?.error).toContain(error.message); // Added optional chaining
    expect(itemResult?.suggestion).toContain('Check embedding model configuration'); // Added optional chaining

    expect(mockGenerateEmbeddings).toHaveBeenCalledOnce();
    // IndexManager.create should not be called if embedding fails before it
    expect(MockIndexManagerCreate).not.toHaveBeenCalled();
    expect(mockQueryIndex).not.toHaveBeenCalled();
  });

  it('should handle index query failure', async () => {
    const input = { queryText: 'fail query', topK: 5 };
    const error = new Error('Query failed');
    mockQueryIndex.mockRejectedValue(error);

    const parts = await queryIndexTool.execute(input, defaultOptions);
    const results = getJsonResult<QueryIndexResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    // Error message might be wrapped, check containment
    expect(itemResult?.error).toContain(error.message); // Added optional chaining
    expect(itemResult?.suggestion).toContain('Check vector database configuration'); // Corrected suggestion check

    expect(mockGenerateEmbeddings).toHaveBeenCalledOnce();
    expect(MockIndexManagerCreate).toHaveBeenCalledOnce();
    expect(mockQueryIndex).toHaveBeenCalledOnce();
  });

  it('should handle no results found', async () => {
    const input = { queryText: 'no results query', topK: 5 };
    mockQueryIndex.mockResolvedValue([]); // Configure the query mock

    const parts = await queryIndexTool.execute(input, defaultOptions);
    const results = getJsonResult<QueryIndexResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];

    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.query).toBe('no results query'); // Added optional chaining
    expect(itemResult?.results).toHaveLength(0); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining

    expect(mockGenerateEmbeddings).toHaveBeenCalledOnce();
    expect(MockIndexManagerCreate).toHaveBeenCalledOnce();
    expect(mockQueryIndex).toHaveBeenCalledOnce();
  });

  it('should pass filter and topK to queryIndex', async () => {
    const input = {
      queryText: 'query with filter',
      topK: 3,
      filter: { source: 'specific_file.txt', year: 2024 },
    };
    const queryVector = [0.5, 0.5];
    mockGenerateEmbeddings.mockResolvedValue([queryVector]);

    await queryIndexTool.execute(input, defaultOptions);

    expect(mockQueryIndex).toHaveBeenCalledOnce();
    expect(mockQueryIndex).toHaveBeenCalledWith(queryVector, input.topK, input.filter);
  });

  it('should use provided embedding and vector DB configs', async () => {
    const ollamaConfig = {
      // Explicitly use the enum member and add 'as const' for literal type
      provider: EmbeddingModelProvider.Ollama as const,
      modelName: 'custom-ollama',
      baseURL: 'http://custom:11434',
      batchSize: 100,
    };
    const chromaConfig = {
      // Explicitly use the enum member and add 'as const' for literal type
      provider: VectorDbProvider.ChromaDB as const,
      collectionName: 'custom-chroma',
      host: 'http://custom-chroma:8000',
    };
    const input = {
      queryText: 'custom config query',
      topK: 5,
      embeddingConfig: ollamaConfig,
      vectorDbConfig: chromaConfig,
    };
    const queryVector = [0.9, 0.1];
    mockGenerateEmbeddings.mockResolvedValue([queryVector]);

    await queryIndexTool.execute(input, defaultOptions);

    expect(mockGenerateEmbeddings).toHaveBeenCalledWith([input.queryText], input.embeddingConfig);
    expect(MockIndexManagerCreate).toHaveBeenCalledWith(
      input.vectorDbConfig,
      expect.any(embedding.OllamaEmbeddingFunction),
    );
    expect(embedding.OllamaEmbeddingFunction).toHaveBeenCalledWith(
      'custom-ollama',
      'http://custom:11434',
    );
    expect(mockQueryIndex).toHaveBeenCalledWith(queryVector, 5, undefined);
  });

  it('should instantiate HttpEmbeddingFunction when HTTP config is provided', async () => {
    const httpConfig = {
      // Explicitly use the enum member and add 'as const' for literal type
      provider: EmbeddingModelProvider.Http as const,
      url: 'http://test-embed:80',
      headers: { 'X-Api-Key': 'test-key' },
      batchSize: 50,
    };
    const input = {
      queryText: 'http config query',
      topK: 2,
      embeddingConfig: httpConfig,
    };
    const queryVector = [0.4, 0.6];
    mockGenerateEmbeddings.mockResolvedValue([queryVector]);

    await queryIndexTool.execute(input, defaultOptions);

    expect(mockGenerateEmbeddings).toHaveBeenCalledWith([input.queryText], input.embeddingConfig);
    expect(MockIndexManagerCreate).toHaveBeenCalledWith(
      { provider: VectorDbProvider.InMemory }, // Default DB
      expect.any(embedding.HttpEmbeddingFunction), // Expect HTTP instance
    );
    expect(embedding.HttpEmbeddingFunction).toHaveBeenCalledWith(
      httpConfig.url,
      httpConfig.headers,
      httpConfig.batchSize,
    );
    expect(mockQueryIndex).toHaveBeenCalledWith(queryVector, 2, undefined);
  });
});