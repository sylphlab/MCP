import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { Collection, IEmbeddingFunction } from 'chromadb'; // Keep type imports
import { IndexManager, VectorDbProvider, VectorDbConfig, IndexedItem, QueryResult } from './indexManager.js';
// Import functions/modules to spy on
import * as loader from './loader.js';
import * as chunking from './chunking.js';
import * as embedding from './embedding.js';
import * as chroma from './chroma.js'; // Import module to spy on
import type { Document, Chunk } from './types.js';

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

// --- Tests ---

describe('IndexManager', () => {
  let manager: IndexManager;
  const testConfigChroma: VectorDbConfig = {
      provider: VectorDbProvider.ChromaDB,
      collectionName: 'test-chroma-collection',
      path: '/fake/path',
  };
   const testConfigInMemory: VectorDbConfig = {
      provider: VectorDbProvider.InMemory,
  };

  // Spies
  let initializeSpy: any;
  let convertFilterSpy: any;
  // Add other spies if needed for specific tests

  beforeEach(async () => {
    vi.clearAllMocks();

    // --- Setup Spies ---
    initializeSpy = vi.spyOn(IndexManager.prototype as any, 'initialize').mockResolvedValue(undefined);
    // Spy on convertFilterToChromaWhere - ensure chroma module is imported
    convertFilterSpy = vi.spyOn(chroma, 'convertFilterToChromaWhere').mockImplementation((filter) => filter);

    // Reset mock collection methods
    (mockCollection.upsert as Mock).mockResolvedValue({ success: true });
    (mockCollection.get as Mock).mockResolvedValue({ ids: [], embeddings: [], documents: [], metadatas: [] });
    (mockCollection.delete as Mock).mockResolvedValue({ success: true });
    (mockCollection.query as Mock).mockResolvedValue({ ids: [[]], distances: [[]], metadatas: [[]], documents: [[]], embeddings: null });
    (mockCollection.count as Mock).mockResolvedValue(0);

    // Reset in-memory store
    IndexManager._resetInMemoryStoreForTesting();

    // Create manager instance - initialize is now mocked
    manager = await IndexManager.create(testConfigChroma);

    // Manually assign the mocked collection for ChromaDB tests,
    // as initialize (which normally sets it) is mocked.
    manager['chromaCollection'] = mockCollection;

    // Clear mocks called during creation if needed
    initializeSpy.mockClear();

  });

   afterEach(() => {
       vi.restoreAllMocks(); // Restore all mocks after each test in the main suite
   });


  describe('ChromaDB Provider', () => {
    it('should call initialize during creation', async () => {
      vi.restoreAllMocks(); // Restore any previous mocks/spies
      initializeSpy = vi.spyOn(IndexManager.prototype as any, 'initialize').mockResolvedValue(undefined); // Re-apply spy

      const localManager = await IndexManager.create(testConfigChroma);

      expect(initializeSpy).toHaveBeenCalledTimes(1);
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
        expect(results[0].item.content).toBe('doc2');
        expect(results[0].item.metadata?.source).toBe('s2');
        expect(results[0].score).toBeCloseTo(1 - 0.1);
        expect(results[1].item.id).toBe('c1');
        expect(results[1].item.content).toBe('doc1');
        expect(results[1].item.metadata?.source).toBe('s1');
        expect(results[1].score).toBeCloseTo(1 - 0.2);
    });

     it('should query items with filter conversion', async () => {
        const queryVector = [0.5];
        const topK = 1;
        const filter = { type: 'report', year: 2024 };
        // Spy is set up in beforeEach
        convertFilterSpy.mockReturnValue({ type: { '$eq': 'report' }, year: { '$eq': 2024 } });

        await manager.queryIndex(queryVector, topK, filter);

        expect(convertFilterSpy).toHaveBeenCalledWith(filter); // Check spy was called
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
          // DO NOT restore mocks here, outer afterEach handles it.
          // vi.restoreAllMocks();
          initializeSpy = vi.spyOn(IndexManager.prototype as any, 'initialize').mockResolvedValue(undefined); // Mock initialize for InMemory too
          inMemoryManager = await IndexManager.create(testConfigInMemory);
          IndexManager._resetInMemoryStoreForTesting();
      });

       // No need for afterEach here if outer one restores mocks

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
          expect(results[0].item.metadata?.v).toBe(1);

          await inMemoryManager.upsertItems([item2]);
          results = await inMemoryManager.queryIndex([0,1], 1);
          expect(results[0].item.content).toBe('v2');
          expect(results[0].item.metadata?.v).toBe(2);

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
          expect(results[0].item.id).toBe('mem-del-2');

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
          expect(results[0].score).toBeCloseTo(1.0);
          expect(results[1].item.id).toBe('mem-q-1');
          expect(results[1].score).toBeCloseTo(0.9 / Math.sqrt(0.82));
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
          expect(results.map((r: QueryResult) => r.item.id)).toEqual(expect.arrayContaining(['mem-f-1', 'mem-f-3']));

          results = await inMemoryManager.queryIndex([0, 1], 3, { year: 2024 });
          expect(results).toHaveLength(2);
          expect(results.map((r: QueryResult) => r.item.id)).toEqual(expect.arrayContaining(['mem-f-2', 'mem-f-3']));

          results = await inMemoryManager.queryIndex([1, 0], 3, { type: 'X', year: 2024 });
          expect(results).toHaveLength(1);
          expect(results[0].item.id).toBe('mem-f-3');

          results = await inMemoryManager.queryIndex([1, 0], 3, { category: 'Z' });
          expect(results).toHaveLength(0);
      });
  });

});