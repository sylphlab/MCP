import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { Collection, IEmbeddingFunction } from 'chromadb'; // Keep type imports
import { IndexManager, VectorDbProvider, VectorDbConfig, IndexedItem, QueryResult } from './indexManager.js';
// Import functions/modules to spy on
import * as loader from './loader.js';
import * as chunking from './chunking.js';
import * as embedding from './embedding.js';
import * as chroma from './chroma.js'; // Import module to spy on
import type { Document, Chunk } from './types.js';
import { Pinecone, Index as PineconeIndex, RecordMetadata } from '@pinecone-database/pinecone';

// --- Mocks ---

// Mock collection methods
const mockCollection = {
  name: 'mock-collection',
  upsert: vi.fn().mockResolvedValue({ success: true }),
  get: vi.fn().mockResolvedValue({ ids: [], embeddings: [], documents: [], metadatas: [] }),
  delete: vi.fn().mockResolvedValue({ success: true }),
  query: vi.fn().mockResolvedValue({ ids: [[]], distances: [[]], metadatas: [[]], documents: [[]], embeddings: null }),
  count: vi.fn().mockResolvedValue(0),
} as unknown as Collection;

// Mock Pinecone client
const mockPineconeIndex = {
  namespace: vi.fn().mockReturnThis(), // Chainable namespace
  upsert: vi.fn().mockResolvedValue({ upsertedCount: 0 }),
  query: vi.fn().mockResolvedValue({ matches: [] }),
  deleteMany: vi.fn().mockResolvedValue({}),
  listPaginated: vi.fn().mockResolvedValue({ vectors: [], pagination: {} }),
};
const mockPineconeClient = {
  index: vi.fn().mockReturnValue(mockPineconeIndex),
};
vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: vi.fn().mockImplementation(() => mockPineconeClient),
}));
// Mock ChromaClient constructor and getOrCreateCollection
vi.mock('chromadb', async (importOriginal) => {
  const original = await importOriginal() as typeof import('chromadb');
  return {
    ...original,
    ChromaClient: vi.fn().mockImplementation(() => ({
      getOrCreateCollection: vi.fn().mockResolvedValue(mockCollection), // Return the mock collection
    })),
  };
});


// --- Configs ---
const testConfigChroma: VectorDbConfig = {
    provider: VectorDbProvider.ChromaDB,
    collectionName: 'test-chroma-collection',
    path: '/fake/path', // Path is used but client is mocked
};
 const testConfigInMemory: VectorDbConfig = {
    provider: VectorDbProvider.InMemory,
};
const testConfigPinecone: VectorDbConfig = {
    provider: VectorDbProvider.Pinecone,
    apiKey: 'fake-pinecone-key',
    indexName: 'test-pinecone-index',
    namespace: 'test-ns',
};
const dummyEmbeddingFn = { generate: vi.fn() } as unknown as IEmbeddingFunction;

// --- Tests ---

describe('IndexManager', () => {
  let initializeSpy: any;

  beforeEach(() => {
    // Clear all mocks before each test in the outer block
    vi.clearAllMocks();
    // Mock initialize globally before each test
    initializeSpy = vi.spyOn(IndexManager.prototype as any, 'initialize').mockResolvedValue(undefined);
    // Reset in-memory store
    IndexManager._resetInMemoryStoreForTesting();
    // Reset mock collection methods (safe redundancy)
    (mockCollection.upsert as Mock).mockResolvedValue({ success: true });
    (mockCollection.get as Mock).mockResolvedValue({ ids: [], embeddings: [], documents: [], metadatas: [] });
    (mockCollection.delete as Mock).mockResolvedValue({ success: true });
    (mockCollection.query as Mock).mockResolvedValue({ ids: [[]], distances: [[]], metadatas: [[]], documents: [[]], embeddings: null });
    (mockCollection.count as Mock).mockResolvedValue(0);
    // Reset pinecone mocks (safe redundancy)
     mockPineconeIndex.namespace.mockClear().mockReturnThis();
     (mockPineconeIndex.upsert as Mock).mockClear().mockResolvedValue({ upsertedCount: 0 });
     (mockPineconeIndex.query as Mock).mockClear().mockResolvedValue({ matches: [] });
     (mockPineconeIndex.deleteMany as Mock).mockClear().mockResolvedValue({});
     (mockPineconeIndex.listPaginated as Mock).mockClear().mockResolvedValue({ vectors: [], pagination: {} });
     (mockPineconeClient.index as Mock).mockClear().mockReturnValue(mockPineconeIndex);
     (vi.mocked(Pinecone) as Mock).mockClear().mockImplementation(() => mockPineconeClient);

  });

  afterEach(() => {
      // Restore all mocks after each test
      vi.restoreAllMocks();
  });

  describe('ChromaDB Provider', () => {
    let manager: IndexManager;
    let convertFilterSpy: any;

    beforeEach(async () => { // Local beforeEach to create instance
        // Spy on convertFilterToChromaWhere
        convertFilterSpy = vi.spyOn(chroma, 'convertFilterToChromaWhere').mockImplementation((filter) => filter);
        // Create manager instance - initialize is mocked by outer beforeEach
        manager = await IndexManager.create(testConfigChroma, dummyEmbeddingFn);
        // Manually assign the mocked collection because initialize is mocked
        manager['chromaCollection'] = mockCollection;
        initializeSpy.mockClear(); // Clear calls from create
    });

    it('should call initialize during creation', async () => {
      // Mock initialize locally just for this test
      const initSpy = vi.spyOn(IndexManager.prototype as any, 'initialize').mockResolvedValue(undefined);
      const dummyEmbeddingFn = { generate: vi.fn() } as unknown as IEmbeddingFunction;
      const localManager = await IndexManager.create(testConfigChroma, dummyEmbeddingFn);

      expect(initSpy).toHaveBeenCalledTimes(1);
      initSpy.mockRestore(); // Restore local spy
    });

    it('should upsert items correctly mapping data and filtering metadata', async () => {
      const items: IndexedItem[] = [
        { id: 'c1', content: 'doc1', vector: [0.1], metadata: { source: 's1', num: 1, bool: true, obj: {a:1} } },
        { id: 'c2', content: 'doc2', vector: [0.2], metadata: { source: 's2', valid: 'yes' } },
        { id: 'c3', content: 'doc3', vector: [0.3], metadata: {} },
      ];
      await manager.upsertItems(items);

      expect(mockCollection.upsert).toHaveBeenCalledOnce();
      expect(mockCollection.upsert).toHaveBeenCalledWith({
        ids: ['c1', 'c2', 'c3'],
        embeddings: [[0.1], [0.2], [0.3]],
        metadatas: [
          { source: 's1', num: 1, bool: true },
          { source: 's2', valid: 'yes' },
          {},
        ],
        documents: ['doc1', 'doc2', 'doc3'],
      });
    });

    it('should delete items', async () => {
      const idsToDelete = ['c1', 'c3'];
      await manager.deleteItems(idsToDelete);
      expect(mockCollection.delete).toHaveBeenCalledWith({ ids: idsToDelete });
    });

    it('should query items and map results correctly', async () => {
        const queryVector = [0.5];
        const topK = 2;
        const mockQueryResults = {
            ids: [['c2', 'c1']],
            distances: [[0.1, 0.2]],
            metadatas: [[{ source: 's2' }, { source: 's1' }]],
            documents: [['doc2', 'doc1']],
            embeddings: null,
        };
        (mockCollection.query as Mock).mockResolvedValue(mockQueryResults);

        const results = await manager.queryIndex(queryVector, topK);

        expect(mockCollection.query).toHaveBeenCalledWith({
            queryEmbeddings: [queryVector],
            nResults: topK,
            where: undefined,
            include: ["metadatas", "documents", "distances"],
        });
        expect(results).toHaveLength(2);
        expect(results[0].item.id).toBe('c2');
        expect(results[1].item.id).toBe('c1');
        expect(results[0].score).toBeCloseTo(1 - 0.1);
        expect(results[1].score).toBeCloseTo(1 - 0.2);
    });

     it('should query items with filter conversion', async () => {
        const queryVector = [0.5];
        const topK = 1;
        const filter = { type: 'report', year: 2024 };
        convertFilterSpy.mockReturnValue({ type: { '$eq': 'report' }, year: { '$eq': 2024 } });

        await manager.queryIndex(queryVector, topK, filter);

        expect(convertFilterSpy).toHaveBeenCalledWith(filter);
        expect(mockCollection.query).toHaveBeenCalledWith(expect.objectContaining({
            where: { type: { '$eq': 'report' }, year: { '$eq': 2024 } },
            nResults: topK,
        }));
    });

    it('should handle query errors', async () => {
        const queryError = new Error('Chroma query failed');
        (mockCollection.query as Mock).mockRejectedValue(queryError);
        await expect(manager.queryIndex([0.1], 1)).rejects.toThrow(`Query failed: ${queryError.message}`);
    });

     it('should handle upsert errors', async () => {
        const upsertError = new Error('Chroma upsert failed');
        (mockCollection.upsert as Mock).mockRejectedValue(upsertError);
        await expect(manager.upsertItems([{id: 'e1', content: 'err', vector: [0]}])).rejects.toThrow(`Upsert failed: ${upsertError.message}`);
    });

     it('should handle delete errors', async () => {
        const deleteError = new Error('Chroma delete failed');
        (mockCollection.delete as Mock).mockRejectedValue(deleteError);
        await expect(manager.deleteItems(['e1'])).rejects.toThrow(`Delete failed: ${deleteError.message}`);
    });

  });

  describe('InMemory Provider', () => {
      let inMemoryManager: IndexManager;

      beforeEach(async () => {
          // initialize is mocked by outer beforeEach
          inMemoryManager = await IndexManager.create(testConfigInMemory);
      });

      // No afterEach needed, outer one handles restore

     it('should upsert items', async () => {
          const items: IndexedItem[] = [
              { id: 'mem1', content: 'mem doc 1', vector: [0.1, 0.9], metadata: { type: 'A' } },
              { id: 'mem2', content: 'mem doc 2', vector: [0.9, 0.1], metadata: { type: 'B' } },
          ];
          await inMemoryManager.upsertItems(items);
          const results = await inMemoryManager.queryIndex([0,1], 10);
          expect(results.length).toBe(2);
      });

      it('should update existing items on upsert', async () => {
          const item1: IndexedItem = { id: 'mem-upd', content: 'v1', vector: [1, 0], metadata: { v: 1 } };
          const item2: IndexedItem = { id: 'mem-upd', content: 'v2', vector: [0, 1], metadata: { v: 2 } };
          await inMemoryManager.upsertItems([item1]);
          let results = await inMemoryManager.queryIndex([1,0], 1);
          expect(results[0].item.content).toBe('v1');

          await inMemoryManager.upsertItems([item2]);
          results = await inMemoryManager.queryIndex([0,1], 1);
          expect(results[0].item.content).toBe('v2');

          results = await inMemoryManager.queryIndex([0,0], 10);
          expect(results.length).toBe(1);
      });

      it('should delete items', async () => {
          const items: IndexedItem[] = [
              { id: 'mem-del-1', content: 'del 1', vector: [1, 0] },
              { id: 'mem-del-2', content: 'del 2', vector: [0, 1] },
          ];
          await inMemoryManager.upsertItems(items);
          await inMemoryManager.deleteItems(['mem-del-1', 'non-existent']);
          let results = await inMemoryManager.queryIndex([0,0], 10);
          expect(results.length).toBe(1);

          await inMemoryManager.deleteItems(['mem-del-2']);
          results = await inMemoryManager.queryIndex([0,0], 10);
          expect(results.length).toBe(0);
      });

      it('should query items and return top K results sorted by similarity', async () => {
          const items: IndexedItem[] = [
              { id: 'mem-q-1', content: 'close', vector: [0.9, 0.1] },
              { id: 'mem-q-2', content: 'far', vector: [-1, 0] },
              { id: 'mem-q-3', content: 'closer', vector: [1, 0] },
          ];
          await inMemoryManager.upsertItems(items);
          const results = await inMemoryManager.queryIndex([1, 0], 2);
          expect(results).toHaveLength(2);
          expect(results[0].item.id).toBe('mem-q-3');
          expect(results[1].item.id).toBe('mem-q-1');
      });

       it('should filter items during query', async () => {
          const items: IndexedItem[] = [
              { id: 'mem-f-1', content: 'A', vector: [1, 0], metadata: { type: 'X', year: 2023 } },
              { id: 'mem-f-2', content: 'B', vector: [0, 1], metadata: { type: 'Y', year: 2024 } },
              { id: 'mem-f-3', content: 'C', vector: [0.9, 0.1], metadata: { type: 'X', year: 2024 } },
          ];
          await inMemoryManager.upsertItems(items);
          let results = await inMemoryManager.queryIndex([1, 0], 3, { type: 'X' });
          expect(results).toHaveLength(2);

          results = await inMemoryManager.queryIndex([0, 1], 3, { year: 2024 });
          expect(results).toHaveLength(2);

          results = await inMemoryManager.queryIndex([1, 0], 3, { type: 'X', year: 2024 });
          expect(results).toHaveLength(1);

          results = await inMemoryManager.queryIndex([1, 0], 3, { category: 'Z' });
          expect(results).toHaveLength(0);
      });
  });

  describe('Pinecone Provider', () => {
    let pineconeManager: IndexManager;

    beforeEach(async () => {
        // initialize is mocked by outer beforeEach
        pineconeManager = await IndexManager.create(testConfigPinecone);
        // Manually assign properties AFTER creation, using module-level mocks
        pineconeManager['pineconeClient'] = mockPineconeClient as any;
        pineconeManager['pineconeIndex'] = mockPineconeIndex as any;
        initializeSpy.mockClear(); // Clear calls from create
    });

    // No afterEach needed, outer one handles restore

    it('should call initialize during creation', async () => {
        // Mock initialize locally just for this test
        const initSpy = vi.spyOn(IndexManager.prototype as any, 'initialize').mockResolvedValue(undefined);
        const manager = await IndexManager.create(testConfigPinecone); // Create will call mocked initialize

        expect(initSpy).toHaveBeenCalledTimes(1); // Check the local spy
        initSpy.mockRestore(); // Restore local spy
    });

    it('should upsert items in batches', async () => {
        const items: IndexedItem[] = Array.from({ length: 150 }, (_, i) => ({
            id: `pine-${i}`, content: `doc ${i}`, vector: [i / 100], metadata: { idx: i }
        }));
        console.log('[TEST] pineconeManager.pineconeIndex before upsert:', pineconeManager['pineconeIndex']); // DEBUG LOG
        await pineconeManager.upsertItems(items);

        expect(mockPineconeIndex.namespace).toHaveBeenCalledWith('test-ns');
        expect(mockPineconeIndex.upsert).toHaveBeenCalledTimes(2);
        expect((mockPineconeIndex.upsert as Mock).mock.calls[0][0]).toHaveLength(100);
        expect((mockPineconeIndex.upsert as Mock).mock.calls[1][0]).toHaveLength(50);
    });

    it('should delete items in batches', async () => {
        const ids = Array.from({ length: 120 }, (_, i) => `del-${i}`);
        await pineconeManager.deleteItems(ids);

        expect(mockPineconeIndex.namespace).toHaveBeenCalledWith('test-ns');
        expect(mockPineconeIndex.deleteMany).toHaveBeenCalledTimes(1);
        expect((mockPineconeIndex.deleteMany as Mock).mock.calls[0][0]).toEqual(ids);
    });

    it('should query items with filter conversion', async () => {
        const queryVector = [0.5];
        const topK = 3;
        const filter = { type: 'report', year: 2024 };
        const mockResponse = { matches: [ { id: 'p1', score: 0.9, metadata: { type: 'report', year: 2024 } } ] };
        (mockPineconeIndex.query as Mock).mockResolvedValue(mockResponse);

        const results = await pineconeManager.queryIndex(queryVector, topK, filter);

        expect(mockPineconeIndex.namespace).toHaveBeenCalledWith('test-ns');
        expect(mockPineconeIndex.query).toHaveBeenCalledWith({
            vector: queryVector, topK: topK, filter: { type: { '$eq': 'report' }, year: { '$eq': 2024 } }, includeMetadata: true,
        });
        expect(results).toHaveLength(1);
        expect(results[0].item.id).toBe('p1');
    });

     it('should get all IDs with pagination', async () => {
        (mockPineconeIndex.listPaginated as Mock)
            .mockResolvedValueOnce({ vectors: [{ id: 'id1' }, { id: 'id2' }], pagination: { next: 'token1' } })
            .mockResolvedValueOnce({ vectors: [{ id: 'id3' }], pagination: {} });

        const allIds = await pineconeManager.getAllIds();

        expect(mockPineconeIndex.namespace).toHaveBeenCalledWith('test-ns');
        expect(mockPineconeIndex.listPaginated).toHaveBeenCalledTimes(2);
        expect(mockPineconeIndex.listPaginated).toHaveBeenNthCalledWith(1, { limit: 1000, paginationToken: undefined });
        expect(mockPineconeIndex.listPaginated).toHaveBeenNthCalledWith(2, { limit: 1000, paginationToken: 'token1' });
        expect(allIds).toEqual(['id1', 'id2', 'id3']);
    });

  });

}); // Closing brace for outer describe
