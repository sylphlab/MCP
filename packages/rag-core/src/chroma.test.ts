import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'; // Added Mock type
import path from 'node:path';
import { Collection, IEmbeddingFunction } from 'chromadb'; // Import type

// --- Mocks ---
// Define shared mock implementations
const mockGetOrCreateCollection = vi.fn();
const mockChromaClientInstance = {
    getOrCreateCollection: mockGetOrCreateCollection,
};

// Mock the 'chromadb' module - Define constructor mock *inside* factory
vi.mock('chromadb', () => {
    // Define the mock constructor function *inside* the factory
    const mockChromaClientConstructorInternal = vi.fn(() => mockChromaClientInstance);
    return {
        ChromaClient: mockChromaClientConstructorInternal,
        // Preserve other exports if necessary
    };
});

// --- Test Suite ---
// Use dynamic import inside describe/beforeEach/it
describe('ChromaDB Interaction', () => {
    // Declare variables for dynamically imported functions/mocks using let
    let getRagCollection: typeof import('./chroma.js').getRagCollection;
    let convertFilterToChromaWhere: typeof import('./chroma.js').convertFilterToChromaWhere;
    let initChromaClient: any; // Keep as any if accessing private/internal
    let mockChromaClientConstructor: Mock; // Variable to hold the mocked constructor reference

    const projectRoot = '/fake/project';
    const defaultDbPath = path.resolve(projectRoot, './.mcp/chroma_db');
    const customDbPath = path.resolve(projectRoot, './custom_db');
    const mockCollectionName = 'mcp_rag_collection'; // Default name used in chroma.ts
    const mockEmbeddingFn = { generate: async (texts: string[]) => texts.map(() => []) } as IEmbeddingFunction; // Dummy embedding fn
    const mockCollection = { name: mockCollectionName } as unknown as Collection;

    beforeEach(async () => { // Make beforeEach async
        // Reset modules to clear internal cache before each test
        vi.resetModules();

        // Dynamically import the module *after* mocks are applied and modules reset
        const chroma = await import('./chroma.js');
        // Assign to the 'let' variables declared above
        getRagCollection = chroma.getRagCollection;
        convertFilterToChromaWhere = chroma.convertFilterToChromaWhere;
        initChromaClient = (chroma as any).initChromaClient; // Access internal if needed

        // Dynamically import the mocked module to get the constructor reference
        const mockedChromaDb = await import('chromadb');
        // Assign the mocked constructor (wrapped) to the 'let' variable
        mockChromaClientConstructor = vi.mocked(mockedChromaDb.ChromaClient);

        // Clear mocks using standard vi methods
        vi.clearAllMocks(); // Use clearAllMocks to reset call history etc.

        // Reset specific mock behavior if needed (e.g., default success)
        mockGetOrCreateCollection.mockResolvedValue(mockCollection);

        // Disable console logging for cleaner test output
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks(); // Restore console and any other spies
    });

    // Removed describe block for internal 'initChromaClient' tests

    describe('getRagCollection', () => {
        // No separate beforeEach needed here

        it('should initialize client and get/create collection', async () => {
            const collection = await getRagCollection(mockEmbeddingFn, projectRoot);

            expect(mockChromaClientConstructor).toHaveBeenCalledWith({ path: defaultDbPath });
            expect(mockGetOrCreateCollection).toHaveBeenCalledTimes(1);
            expect(mockGetOrCreateCollection).toHaveBeenCalledWith({
                name: mockCollectionName,
                embeddingFunction: mockEmbeddingFn,
            });
            expect(collection).toBe(mockCollection);
        });

        it('should throw error if getOrCreateCollection fails', async () => {
            const collectionError = new Error('Failed to access collection');
            mockGetOrCreateCollection.mockRejectedValueOnce(collectionError); // Set rejection for this test

            await expect(getRagCollection(mockEmbeddingFn, projectRoot)).rejects.toThrow(
                `Failed to get/create collection: ${collectionError.message}`
            );
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get or create ChromaDB collection'), collectionError);
        });

        it('should pass custom db path to initChromaClient', async () => {
            await getRagCollection(mockEmbeddingFn, projectRoot, './custom_db');
            expect(mockChromaClientConstructor).toHaveBeenCalledWith({ path: customDbPath });
        });
    });

    describe('convertFilterToChromaWhere', () => {
        it('should convert simple key-value pairs to $eq format', () => {
            const filter = { fileType: 'ts', author: 'JohnDoe' };
            const expectedWhere = { fileType: { $eq: 'ts' }, author: { $eq: 'JohnDoe' } };
            expect(convertFilterToChromaWhere(filter)).toEqual(expectedWhere);
        });

        it('should handle different value types', () => {
            const filter = { lines: 100, isPublic: true, name: 'test' };
            const expectedWhere = { lines: { $eq: 100 }, isPublic: { $eq: true }, name: { $eq: 'test' } };
            expect(convertFilterToChromaWhere(filter)).toEqual(expectedWhere);
        });

        it('should return an empty object for an empty filter', () => {
            const filter = {};
            const expectedWhere = {};
            expect(convertFilterToChromaWhere(filter)).toEqual(expectedWhere);
        });
    });
});