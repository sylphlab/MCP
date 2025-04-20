import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { TextPart } from '@sylphlab/mcp-core'; // Import TextPart
import { IEmbeddingFunction } from 'chromadb'; // Import type

// --- Mocks ---
const mockCount = vi.fn();
// Declare mock inside factory
// const mockGetRagCollection = vi.fn();

// Mock internal modules
vi.mock('../chroma.js', () => {
   // Declare mock inside factory
   const mockGetRagCollectionInternal = vi.fn();
   return { getRagCollection: mockGetRagCollectionInternal };
});

// Get mock instance after mocking (needs await or top-level await)
// Get it inside tests or beforeEach instead
let mockGetRagCollection: any;

// --- Dynamic Import ---
// Import the tool *after* mocks are set up
import { indexStatusTool } from './indexStatusTool.js';

// --- Test Suite ---
describe('indexStatusTool', () => {
  const workspaceRoot = '/fake/workspace';
  const expectedDbPath = path.join(workspaceRoot, '.mcp', 'chroma_db');
  const mockCollectionName = 'mock-collection';

  beforeEach(async () => { // Make async
    // Reset mocks
    mockCount.mockReset();
    // Get mock instance here
    mockGetRagCollection = vi.mocked((await import('../chroma.js')).getRagCollection);
    mockGetRagCollection.mockClear(); // Clear the mock

    // Mock the resolved value of getRagCollection to return a mock collection object
    mockGetRagCollection.mockResolvedValue({
      count: mockCount,
      name: mockCollectionName,
      // Add other collection methods if needed, though only count and name are used
    } as any); // Cast to any

    // Disable console logging
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore console
  });

  it('should return the item count and collection name on success', async () => {
    const itemCount = 123;
    mockCount.mockResolvedValue(itemCount);

    // Input is optional/ignored, pass undefined or empty object
    const result = await indexStatusTool.execute(undefined, workspaceRoot);

    expect(mockGetRagCollection).toHaveBeenCalledWith(
      expect.objectContaining({ // Check if a dummy embedding function was passed
          generate: expect.any(Function)
      }),
      workspaceRoot,
      expectedDbPath
    );
    expect(mockCount).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.count).toBe(itemCount);
    expect(result.collectionName).toBe(mockCollectionName);
    expect(result.content).toHaveLength(1);
    expect((result.content[0] as TextPart).text).toBe(`Index contains ${itemCount} items in collection "${mockCollectionName}".`);
  });

  it('should handle errors when getting the collection', async () => {
    const collectionError = new Error('Failed to connect to DB');
    mockGetRagCollection.mockRejectedValue(collectionError);

    const result = await indexStatusTool.execute(undefined, workspaceRoot);

    expect(mockGetRagCollection).toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled(); // count() should not be called
    expect(result.success).toBe(false);
    expect(result.count).toBe(-1);
    expect(result.collectionName).toBe('');
    expect(result.error).toBe(collectionError.message);
    expect(result.content).toHaveLength(1);
    expect((result.content[0] as TextPart).text).toBe(`Failed to get index status: ${collectionError.message}`);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error executing indexStatusTool'), collectionError);
  });

  it('should handle errors when counting items', async () => {
    const countError = new Error('Failed to count items');
    mockCount.mockRejectedValue(countError);

    const result = await indexStatusTool.execute(undefined, workspaceRoot);

    expect(mockGetRagCollection).toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.count).toBe(-1);
    expect(result.collectionName).toBe('');
    expect(result.error).toBe(countError.message);
    expect(result.content).toHaveLength(1);
    expect((result.content[0] as TextPart).text).toBe(`Failed to get index status: ${countError.message}`);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error executing indexStatusTool'), countError);
  });

   it('should warn if dummy embedding function generate is called', async () => {
        const itemCount = 5;
        mockCount.mockResolvedValue(itemCount);

        // Modify the mock to capture the passed embedding function
        let capturedEmbeddingFn: any;
        mockGetRagCollection.mockImplementation(async (embeddingFn: IEmbeddingFunction) => { // Add type
            capturedEmbeddingFn = embeddingFn;
            return { count: mockCount, name: mockCollectionName } as any; // Cast to any
        });

        await indexStatusTool.execute(undefined, workspaceRoot);

        // Call the captured dummy function's generate method
        await capturedEmbeddingFn.generate(['test']);

        expect(console.warn).toHaveBeenCalledWith("Dummy embedding function generate called unexpectedly during status check.");
    });
});