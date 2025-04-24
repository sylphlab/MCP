import path from 'node:path';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part and ToolExecuteOptions
import type { IEmbeddingFunction } from 'chromadb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexStatusTool } from './indexStatusTool.js'; // Import the tool
import type { IndexStatusResult } from './indexStatusTool.js'; // Import correct result type
import { getRagCollection } from '../chroma.js'; // Import the function to be mocked

// --- Mocks ---
const mockCount = vi.fn();

// Mock the module, returning a new mock function inside the factory
vi.mock('../chroma.js', () => ({
  getRagCollection: vi.fn(), // Return a mock function directly
}));

// Moved getJsonResult outside vi.mock
// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  const jsonPart = parts.find((part) => part.type === 'json');
  if (jsonPart && jsonPart.value !== undefined) {
    try {
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  return undefined;
}

const WORKSPACE_ROOT = '/test/workspace'; // Defined WORKSPACE_ROOT
const defaultOptions: ToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT }; // Use WORKSPACE_ROOT
const mockCollectionName = 'mock-collection';
const expectedDbPath = path.join(WORKSPACE_ROOT, '.mcp', 'chroma_db'); // Corrected expected DB path

describe('indexStatusTool', () => {
  // Get a typed reference to the mocked function AFTER vi.mock
  const mockGetRagCollection = vi.mocked(getRagCollection);

  beforeEach(async () => {
    // Reset mocks
    mockCount.mockReset();
    mockGetRagCollection.mockClear(); // Clear the mock function directly

    // Mock the resolved value of getRagCollection for each test
    mockGetRagCollection.mockResolvedValue({
      count: mockCount,
      name: mockCollectionName,
    } as any);

    // Disable console logging
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the item count and collection name on success', async () => {
    const itemCount = 123;
    mockCount.mockResolvedValue(itemCount);

    const parts = await indexStatusTool.execute(undefined, defaultOptions);
    const results = getJsonResult<IndexStatusResult>(parts); // Added type argument

    expect(mockGetRagCollection).toHaveBeenCalledWith(
      expect.objectContaining({ generate: expect.any(Function) }),
      WORKSPACE_ROOT, // Use WORKSPACE_ROOT
      expectedDbPath,
    );
    expect(mockCount).toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.count).toBe(itemCount); // Added optional chaining
    expect(itemResult?.collectionName).toBe(mockCollectionName); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
  });

  it('should handle errors when getting the collection', async () => {
    const collectionError = new Error('Failed to connect to DB');
    mockGetRagCollection.mockRejectedValue(collectionError);

    // Tool should return error in result, not throw
    const parts = await indexStatusTool.execute(undefined, defaultOptions);
    const results = getJsonResult<IndexStatusResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false);
    expect(itemResult?.error).toContain(collectionError.message);
    expect(itemResult?.suggestion).toContain('Check ChromaDB setup');


    expect(mockGetRagCollection).toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('should handle errors when counting items', async () => {
    const countError = new Error('Failed to count items');
    mockCount.mockRejectedValue(countError);

    // Tool should return error in result, not throw
    const parts = await indexStatusTool.execute(undefined, defaultOptions);
    const results = getJsonResult<IndexStatusResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false);
    expect(itemResult?.error).toContain(countError.message);
    expect(itemResult?.suggestion).toContain('Check ChromaDB setup');


    expect(mockGetRagCollection).toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalled();
  });

  // This test might be less relevant now as errors are thrown, but keep if needed
  it('should warn if dummy embedding function generate is called (though unlikely)', async () => {
    const itemCount = 5;
    mockCount.mockResolvedValue(itemCount);

    let capturedEmbeddingFn: any;
    mockGetRagCollection.mockImplementation(async (embeddingFn: IEmbeddingFunction) => {
      capturedEmbeddingFn = embeddingFn;
      return { count: mockCount, name: mockCollectionName } as any;
    });

    await indexStatusTool.execute(undefined, defaultOptions);

    // Call the captured dummy function's generate method - it should just return empty arrays
    const dummyResult = await capturedEmbeddingFn.generate(['test']);
    expect(dummyResult).toEqual([[]]); // Dummy function returns empty arrays
  });
});
