import path from 'node:path';
import type { McpToolExecuteOptions, TextPart } from '@sylphlab/mcp-core'; // Import TextPart and McpToolExecuteOptions
import type { IEmbeddingFunction } from 'chromadb'; // Import type
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
// biome-ignore lint/suspicious/noExplicitAny: Mock variable type
let mockGetRagCollection: any;

// --- Dynamic Import ---
// Import the tool *after* mocks are set up
import { indexStatusTool } from './indexStatusTool.js';

// --- Test Suite ---
describe('indexStatusTool', () => {
  const workspaceRoot = '/fake/workspace';
  const expectedDbPath = path.join(workspaceRoot, '.mcp', 'chroma_db');
  const mockCollectionName = 'mock-collection';
  const defaultOptions: McpToolExecuteOptions = { workspaceRoot: workspaceRoot }; // Define options

  beforeEach(async () => {
    // Make async
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
      // biome-ignore lint/suspicious/noExplicitAny: Casting mock object for return value typing
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
    const result = await indexStatusTool.execute(undefined, defaultOptions); // Pass options object

    expect(mockGetRagCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        // Check if a dummy embedding function was passed
        generate: expect.any(Function),
      }),
      workspaceRoot,
      expectedDbPath,
    );
    expect(mockCount).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.count).toBe(itemCount);
    expect(result.collectionName).toBe(mockCollectionName);
    expect(result.content).toHaveLength(1);
    expect((result.content[0] as TextPart).text).toBe(
      `Index contains ${itemCount} items in collection "${mockCollectionName}".`,
    );
  });

  it('should handle errors when getting the collection', async () => {
    const collectionError = new Error('Failed to connect to DB');
    mockGetRagCollection.mockRejectedValue(collectionError);

    const result = await indexStatusTool.execute(undefined, defaultOptions); // Pass options object

    expect(mockGetRagCollection).toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled(); // count() should not be called
    expect(result.success).toBe(false);
    expect(result.count).toBeUndefined(); // Expect undefined as error is caught by defineTool
    expect(result.collectionName).toBeUndefined(); // Expect undefined
    expect(result.error).toBe(`Tool 'getIndexStatus' execution failed: ${collectionError.message}`); // Expect prefixed error
    expect(result.content).toHaveLength(1);
    expect((result.content[0] as TextPart).text).toBe( // Content text should also be prefixed
      `Tool execution failed: ${collectionError.message}`,
    );
  });

  it('should handle errors when counting items', async () => {
    const countError = new Error('Failed to count items');
    mockCount.mockRejectedValue(countError);

    const result = await indexStatusTool.execute(undefined, defaultOptions); // Pass options object

    expect(mockGetRagCollection).toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.count).toBeUndefined(); // Expect undefined as error is caught by defineTool
    expect(result.collectionName).toBeUndefined(); // Expect undefined
    expect(result.error).toBe(`Tool 'getIndexStatus' execution failed: ${countError.message}`); // Expect prefixed error
    expect(result.content).toHaveLength(1);
    expect((result.content[0] as TextPart).text).toBe( // Content text should also be prefixed
      `Tool execution failed: ${countError.message}`,
    );
  });

  it('should warn if dummy embedding function generate is called', async () => {
    const itemCount = 5;
    mockCount.mockResolvedValue(itemCount);

    // Modify the mock to capture the passed embedding function
    // biome-ignore lint/suspicious/noExplicitAny: Variable to capture mock parameter
    let capturedEmbeddingFn: any;
    mockGetRagCollection.mockImplementation(async (embeddingFn: IEmbeddingFunction) => {
      // Add type
      capturedEmbeddingFn = embeddingFn;
      // biome-ignore lint/suspicious/noExplicitAny: Casting mock object for return value typing
      return { count: mockCount, name: mockCollectionName } as any; // Cast to any
    });

    await indexStatusTool.execute(undefined, defaultOptions); // Pass options object

    // Call the captured dummy function's generate method
    await capturedEmbeddingFn.generate(['test']);
  });
});
