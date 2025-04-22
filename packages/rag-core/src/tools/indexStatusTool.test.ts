import path from 'node:path';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part and McpToolExecuteOptions
import type { IEmbeddingFunction } from 'chromadb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexStatusTool } from './indexStatusTool.js'; // Import the tool
import type { IndexStatusResult } from './indexStatusTool.js'; // Import correct result type

// --- Mocks ---
const mockCount = vi.fn();
let mockGetRagCollection: any; // Declare here, assign in beforeEach

vi.mock('../chroma.js', async () => {
  const actual = await vi.importActual('../chroma.js');
  mockGetRagCollection = vi.fn(); // Assign mock function here
  return {
    ...actual, // Keep other exports if any
    getRagCollection: mockGetRagCollection,
  };
  // Helper to extract JSON result from parts
  // Use generics to handle different result types
  function getJsonResult<T>(parts: Part[]): T[] | undefined {
    // console.log('DEBUG: getJsonResult received parts:', JSON.stringify(parts, null, 2)); // Keep commented for now
    const jsonPart = parts.find((part) => part.type === 'json');
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
    // console.log('DEBUG: jsonPart or jsonPart.value is undefined or null.'); // Keep commented for now
    return undefined;
  }
  const mockCollectionName = 'mock-collection';
  const defaultOptions: McpToolExecuteOptions = { workspaceRoot: workspaceRoot };

  beforeEach(async () => {
    // Reset mocks
    mockCount.mockReset();
    if (mockGetRagCollection) {
      // Ensure mock is assigned before clearing
      mockGetRagCollection.mockClear();
      // Mock the resolved value of getRagCollection
      mockGetRagCollection.mockResolvedValue({
        count: mockCount,
        name: mockCollectionName,
      } as any);
    }

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
    const results = getJsonResult(parts);

    expect(mockGetRagCollection).toHaveBeenCalledWith(
      expect.objectContaining({ generate: expect.any(Function) }),
      workspaceRoot,
      expectedDbPath,
    );
    expect(mockCount).toHaveBeenCalled();

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.count).toBe(itemCount);
    expect(itemResult.collectionName).toBe(mockCollectionName);
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle errors when getting the collection', async () => {
    const collectionError = new Error('Failed to connect to DB');
    mockGetRagCollection.mockRejectedValue(collectionError);

    // Expect the execute call itself to throw now
    await expect(indexStatusTool.execute(undefined, defaultOptions)).rejects.toThrow(
      collectionError.message,
    );

    expect(mockGetRagCollection).toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('should handle errors when counting items', async () => {
    const countError = new Error('Failed to count items');
    mockCount.mockRejectedValue(countError);

    // Expect the execute call itself to throw now
    await expect(indexStatusTool.execute(undefined, defaultOptions)).rejects.toThrow(
      countError.message,
    );

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
