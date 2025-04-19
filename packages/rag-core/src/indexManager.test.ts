import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChromaClient, Collection } from 'chromadb-client';
import { indexProject, queryIndex } from './indexManager.js';
import * as loader from './loader.js';
import * as chunking from './chunking.js';
import * as embedding from './embedding.js';
import * as chroma from './chroma.js';
import type { Document } from './types.js';
import type { Chunk } from './chunking.js'; // Import Chunk type

// --- Mocks ---

// Mock ChromaClient methods
const mockCollection = {
  name: 'mock-collection',
  upsert: vi.fn().mockResolvedValue({ success: true }), // Adjust based on actual return type
  get: vi.fn().mockResolvedValue({ ids: [], embeddings: [], documents: [], metadatas: [] }),
  delete: vi.fn().mockResolvedValue({ success: true }), // Adjust based on actual return type
  query: vi.fn().mockResolvedValue({ ids: [[]], distances: [[]], metadatas: [[]], documents: [[]], embeddings: null }), // Adjusted based on potential structure
  count: vi.fn().mockResolvedValue(0),
} as unknown as Collection; // Cast to Collection type

vi.mock('./loader.js', () => ({
  loadDocuments: vi.fn(),
}));

vi.mock('./chunking.js', () => ({
  chunkDocument: vi.fn(),
}));

vi.mock('./embedding.js', () => ({
  generateEmbeddings: vi.fn(),
  VercelAIEmbeddingFunction: vi.fn().mockImplementation(() => ({ // Mock the class constructor
    generate: vi.fn(), // Mock the generate method if needed by chroma mock
  })),
}));

vi.mock('./chroma.js', () => ({
  getRagCollection: vi.fn().mockResolvedValue(mockCollection),
}));

// --- Tests ---

describe('indexManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations if needed
    (loader.loadDocuments as vi.Mock).mockResolvedValue([]);
    (chunking.chunkDocument as vi.Mock).mockResolvedValue([]);
    (embedding.generateEmbeddings as vi.Mock).mockResolvedValue([]);
    (chroma.getRagCollection as vi.Mock).mockResolvedValue(mockCollection);
    (mockCollection.get as vi.Mock).mockResolvedValue({ ids: [], embeddings: [], documents: [], metadatas: [] });
    (mockCollection.count as vi.Mock).mockResolvedValue(0);

  });

  describe('indexProject', () => {
    it('should call load, chunk, embed, and upsert', async () => {
      const docs: Document[] = [{ id: 'doc1', content: 'content1', metadata: {} }];
      const chunks: Chunk[] = [{ id: 'doc1::chunk_0', content: 'content1', metadata: {}, startPosition: 0, endPosition: 8 }];
      const embeddings = [[0.1, 0.2]];

      (loader.loadDocuments as vi.Mock).mockResolvedValue(docs);
      (chunking.chunkDocument as vi.Mock).mockResolvedValue(chunks);
      (embedding.generateEmbeddings as vi.Mock).mockResolvedValue(embeddings);

      await indexProject({ projectRoot: '/test/project' });

      expect(loader.loadDocuments).toHaveBeenCalledWith('/test/project');
      expect(chunking.chunkDocument).toHaveBeenCalledWith(docs[0]);
      expect(embedding.generateEmbeddings).toHaveBeenCalledWith([chunks[0].content]);
      expect(chroma.getRagCollection).toHaveBeenCalled();
      expect(mockCollection.upsert).toHaveBeenCalledWith({
        ids: [chunks[0].id],
        embeddings: embeddings,
        metadatas: [chunks[0].metadata],
        documents: [chunks[0].content],
      });
    });

    it('should handle empty documents', async () => {
      (loader.loadDocuments as vi.Mock).mockResolvedValue([]);
      await indexProject({ projectRoot: '/test/project' });
      expect(chunking.chunkDocument).not.toHaveBeenCalled();
      expect(embedding.generateEmbeddings).not.toHaveBeenCalled();
      expect(mockCollection.upsert).not.toHaveBeenCalled();
    });

     it('should handle empty chunks', async () => {
      const docs: Document[] = [{ id: 'doc1', content: 'content1', metadata: {} }];
      (loader.loadDocuments as vi.Mock).mockResolvedValue(docs);
      (chunking.chunkDocument as vi.Mock).mockResolvedValue([]); // No chunks generated

      await indexProject({ projectRoot: '/test/project' });

      expect(loader.loadDocuments).toHaveBeenCalled();
      expect(chunking.chunkDocument).toHaveBeenCalled();
      expect(embedding.generateEmbeddings).not.toHaveBeenCalled();
      expect(mockCollection.upsert).not.toHaveBeenCalled();
    });

    it('should call delete for stale documents', async () => {
      const currentDocs: Document[] = [{ id: 'doc1', content: 'content1', metadata: {} }];
      const currentChunks: Chunk[] = [{ id: 'doc1::chunk_0', content: 'content1', metadata: {}, startPosition: 0, endPosition: 8 }];
      const currentEmbeddings = [[0.1, 0.2]];
      const existingIdsInDb = ['doc1::chunk_0', 'stale_doc::chunk_0'];

      (loader.loadDocuments as vi.Mock).mockResolvedValue(currentDocs);
      (chunking.chunkDocument as vi.Mock).mockResolvedValue(currentChunks);
      (embedding.generateEmbeddings as vi.Mock).mockResolvedValue(currentEmbeddings);
      (mockCollection.get as vi.Mock).mockResolvedValue({ ids: existingIdsInDb }); // Simulate existing IDs

      await indexProject({ projectRoot: '/test/project' });

      expect(mockCollection.upsert).toHaveBeenCalled();
      expect(mockCollection.get).toHaveBeenCalled();
      expect(mockCollection.delete).toHaveBeenCalledWith({ ids: ['stale_doc::chunk_0'] });
    });

     it('should not call delete if no stale documents found', async () => {
      const currentDocs: Document[] = [{ id: 'doc1', content: 'content1', metadata: {} }];
      const currentChunks: Chunk[] = [{ id: 'doc1::chunk_0', content: 'content1', metadata: {}, startPosition: 0, endPosition: 8 }];
      const currentEmbeddings = [[0.1, 0.2]];
      const existingIdsInDb = ['doc1::chunk_0']; // Only current IDs

      (loader.loadDocuments as vi.Mock).mockResolvedValue(currentDocs);
      (chunking.chunkDocument as vi.Mock).mockResolvedValue(currentChunks);
      (embedding.generateEmbeddings as vi.Mock).mockResolvedValue(currentEmbeddings);
      (mockCollection.get as vi.Mock).mockResolvedValue({ ids: existingIdsInDb });

      await indexProject({ projectRoot: '/test/project' });

      expect(mockCollection.upsert).toHaveBeenCalled();
      expect(mockCollection.get).toHaveBeenCalled();
      expect(mockCollection.delete).not.toHaveBeenCalled();
    });

    // TODO: Add tests for error handling in each step
  });

  describe('queryIndex', () => {
     it('should generate query embedding and call collection.query', async () => {
        const queryText = 'test query';
        const queryEmbedding = [[0.5, 0.6]];
        const queryResults = { ids: [['res1']], distances: [[0.1]], metadatas: [[{}]], documents: [['result doc']] };

        (embedding.generateEmbeddings as vi.Mock).mockResolvedValue(queryEmbedding);
        (mockCollection.query as vi.Mock).mockResolvedValue(queryResults);

        const results = await queryIndex(queryText, 1, '/test/db');

        expect(embedding.generateEmbeddings).toHaveBeenCalledWith([queryText]);
        expect(chroma.getRagCollection).toHaveBeenCalledWith(expect.any(embedding.VercelAIEmbeddingFunction), '/test/db');
        expect(mockCollection.query).toHaveBeenCalledWith({
            queryEmbeddings: queryEmbedding,
            nResults: 1,
        });
        expect(results).toEqual(queryResults);
     });

     it('should throw if query embedding fails', async () => {
        (embedding.generateEmbeddings as vi.Mock).mockResolvedValue([]); // Simulate failure
        await expect(queryIndex('test', 1)).rejects.toThrow('Failed to generate query embedding.');
     });

     it('should re-throw error from collection.query', async () => {
        const queryError = new Error('Chroma query failed');
        (embedding.generateEmbeddings as vi.Mock).mockResolvedValue([[0.1]]);
        (mockCollection.query as vi.Mock).mockRejectedValue(queryError);

        await expect(queryIndex('test', 1)).rejects.toThrow(queryError);
     });

     // TODO: Add tests for different nResults and options
  });
});