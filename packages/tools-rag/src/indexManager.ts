import path from 'node:path';
import {
  Pinecone,
  type Index as PineconeIndex,
  type RecordMetadata,
} from '@pinecone-database/pinecone';
import { ChromaClient, type Collection, IncludeEnum, type Metadata, Where } from 'chromadb';
import { z } from 'zod';
import { convertFilterToChromaWhere } from './chroma.js';
import type { EmbeddingVector, IEmbeddingFunction } from './embedding.js'; // Import IEmbeddingFunction
import type { Chunk } from './types.js';

// Define specific vector database providers
export enum VectorDbProvider {
  InMemory = 'in-memory',
  Pinecone = 'pinecone',
  ChromaDB = 'chromadb',
}

// Define schemas for each provider's specific config
const InMemoryConfigSchema = z.object({
  provider: z.literal(VectorDbProvider.InMemory),
});

const PineconeConfigSchema = z.object({
  provider: z.literal(VectorDbProvider.Pinecone),
  apiKey: z.string().min(1, 'Pinecone API key is required'),
  indexName: z.string().min(1, 'Pinecone index name is required'),
  namespace: z.string().optional(),
});

const ChromaDBConfigSchema = z.object({
  provider: z.literal(VectorDbProvider.ChromaDB),
  path: z.string().optional(), // Keep path optional for potential future use/clarity
  host: z.string().optional(), // Keep host optional
  collectionName: z.string().default('mcp_rag_collection'),
});

// Use discriminated union for the main config schema
export const VectorDbConfigSchema = z.discriminatedUnion('provider', [
  InMemoryConfigSchema,
  PineconeConfigSchema,
  ChromaDBConfigSchema,
]);

// Default config (using InMemory)
const _defaultVectorDbConfig = { provider: VectorDbProvider.InMemory } as const;

export type VectorDbConfig = z.infer<typeof VectorDbConfigSchema>;

export interface IndexedItem extends Chunk {
  id: string;
  vector: EmbeddingVector;
}

export interface QueryResult {
  item: IndexedItem;
  score: number;
}

const inMemoryStore: Map<string, IndexedItem> = new Map();

export class IndexManager {
  private config: VectorDbConfig;
  private chromaClient: ChromaClient | null = null;
  private chromaCollection: Collection | null = null;
  private pineconeClient: Pinecone | null = null;
  private pineconeIndex: PineconeIndex | null = null;
  private embeddingFn: IEmbeddingFunction | null = null; // Store embedding function

  private constructor(config: VectorDbConfig) {
    this.config = config;
  }

  /** @internal */
  public static _resetInMemoryStoreForTesting(): void {
    inMemoryStore.clear();
  }

  // Modified create to accept embedding function
  public static async create(
    config: VectorDbConfig,
    embeddingFn?: IEmbeddingFunction,
  ): Promise<IndexManager> {
    const manager = new IndexManager(config);
    // Pass embedding function to initialize
    await manager.initialize(embeddingFn);
    return manager;
  }

  // Modified initialize to accept and use embedding function
  private async initialize(embeddingFn?: IEmbeddingFunction): Promise<void> {
    this.embeddingFn = embeddingFn || null; // Store it
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory:
          break;
        case VectorDbProvider.Pinecone:
          if (!this.config.apiKey || !this.config.indexName) {
            throw new Error('Pinecone config requires apiKey and indexName.');
          }
          this.pineconeClient = new Pinecone({ apiKey: this.config.apiKey });
          this.pineconeIndex = this.pineconeClient.index(this.config.indexName);
          break;
        case VectorDbProvider.ChromaDB: {
          if (!this.embeddingFn) {
            throw new Error(
              'ChromaDB provider requires an embedding function to be provided during IndexManager creation.',
            );
          }
          // ChromaClient constructor expects an object with a 'path' property.
          // Use host URL if provided, otherwise assume local path (which might still fail based on previous errors)
          const clientPath = this.config.host || this.config.path;
          if (!clientPath) {
            throw new Error('ChromaDB config requires either a "path" or a "host".');
          }
          console.log(`[IndexManager] Attempting to initialize ChromaClient with path/host: ${clientPath}`);
          try {
            // Pass the URL or local path via the 'path' property
            this.chromaClient = new ChromaClient({ path: clientPath });
            console.log('[IndexManager] ChromaClient instance created successfully.');
            console.log(`[IndexManager] Attempting to get/create collection: ${this.config.collectionName}`);
            this.chromaCollection = await this.chromaClient.getOrCreateCollection({
              name: this.config.collectionName,
              embeddingFunction: this.embeddingFn,
            });
            console.log(`[IndexManager] Chroma collection '${this.config.collectionName}' obtained.`); // Added Log
          } catch (chromaError) {
            console.error('[IndexManager] Error during ChromaClient/Collection initialization:', chromaError); // Added Log
            throw chromaError; // Re-throw the error after logging
          }
          break;
        }
        default: {
          const exhaustiveCheck: never = this.config;
          throw new Error(`Unhandled vector DB provider during initialization: ${exhaustiveCheck}`);
        }
      }
    } catch (error) {
      throw new Error(
        `IndexManager initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Checks if the manager has been successfully initialized. */
  public isInitialized(): boolean {
      switch (this.config.provider) {
          case VectorDbProvider.InMemory: return true; // Always considered initialized
          case VectorDbProvider.ChromaDB: return !!this.chromaCollection;
          case VectorDbProvider.Pinecone: return !!this.pineconeIndex;
          default: return false;
      }
  }

  /**
   * Instance method to get status (count and name) of the managed collection/index.
   */
  public async getStatus(): Promise<{ count: number; name: string }> {
    if (!this.isInitialized()) { // Add a check if manager is initialized
        throw new Error('IndexManager not initialized. Call initialize() first.');
    }
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory:
          // For InMemory, count is size of map, name is fixed
          return { count: inMemoryStore.size, name: 'in-memory-store' };

        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) {
            // This case should ideally be caught by isInitialized check, but double-check
            throw new Error('ChromaDB collection not available.');
          }
          const count = await this.chromaCollection.count();
          return { count, name: this.chromaCollection.name };
        }

        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) {
             throw new Error('Pinecone index not available.');
          }
          const stats = await this.pineconeIndex.describeIndexStats();
          const namespace = this.config.namespace || ''; // Use instance config
          const count = stats.namespaces?.[namespace]?.recordCount || 0; // Corrected property name
          return { count, name: `${this.config.indexName}${namespace ? `[${namespace}]` : ''}` }; // Use instance config
        }

        default: {
          const exhaustiveCheck: never = this.config; // Use instance config
          throw new Error(`Unsupported vector DB provider for getStatus: ${exhaustiveCheck}`); // Use instance config
        }
      }
    } catch (error) {
       throw new Error(`getStatus failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async upsertItems(items: IndexedItem[]): Promise<void> {
    if (items.length === 0) return;
    if (!this.isInitialized()) throw new Error('IndexManager not initialized.');
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory:
          for (const item of items) {
            inMemoryStore.set(item.id, item);
          }
          break;
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          const batchSize = 100;
          for (let i = 0; i < items.length; i += batchSize) {
            const batchItems = items.slice(i, i + batchSize);
            const vectorsToUpsert = batchItems.map((item) => ({
              id: item.id,
              values: item.vector,
              metadata: item.metadata as RecordMetadata,
            }));
            await ns.upsert(vectorsToUpsert);
          }
          break;
        }
        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
          const ids = items.map((item) => item.id);
          const embeddings = items.map((item) => item.vector);
          const metadatas = items.map((item) => {
            const filteredMeta: Metadata = {};
            if (item.metadata) {
              for (const key in item.metadata) {
                const value = item.metadata[key];
                if (
                  typeof value === 'string' ||
                  typeof value === 'number' ||
                  typeof value === 'boolean'
                ) {
                  filteredMeta[key] = value;
                }
              }
            }
            return filteredMeta;
          });
          const documents = items.map((item) => item.content);
          await this.chromaCollection.upsert({ ids, embeddings, metadatas, documents });
          break;
        }
        default: {
          const exhaustiveCheck: never = this.config;
          throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
      }
    } catch (error) {
      throw new Error(`Upsert failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Get all item IDs from the index
  async getAllIds(): Promise<string[]> {
    if (!this.isInitialized()) throw new Error('IndexManager not initialized.');
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory:
          return Array.from(inMemoryStore.keys());

        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
          const results = await this.chromaCollection.get({ limit: 1000000 });
          return results.ids;
        }

        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          let allIds: string[] = [];
          let nextToken: string | undefined = undefined;
          const limit = 1000;

          do {
            const listResponse = await ns.listPaginated({ limit, paginationToken: nextToken });
            const ids = listResponse.vectors?.flatMap((v) => (v.id ? [v.id] : [])) || [];
            allIds = allIds.concat(ids);
            nextToken = listResponse.pagination?.next;
          } while (nextToken);
          return allIds;
        }

        default:
          return [];
      }
    } catch (error) {
      throw new Error(
        `getAllIds failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    if (!this.isInitialized()) throw new Error('IndexManager not initialized.');
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory: {
          let _deletedCount = 0;
          for (const id of ids) {
            if (inMemoryStore.delete(id)) {
              _deletedCount++;
            }
          }
          break;
        }
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          const batchSize = 1000;
          for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            await ns.deleteMany(batch);
          }
          break;
        }
        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
          await this.chromaCollection.delete({ ids });
          break;
        }
        default: {
          const exhaustiveCheck: never = this.config;
          throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
      }
    } catch (error) {
      throw new Error(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deletes items from the index based on a metadata filter.
   * @param filter - A filter object (e.g., { filePath: 'path/to/file.ts' })
   */
  async deleteWhere(filter: Record<string, string | number | boolean>): Promise<void> {
    if (!filter || Object.keys(filter).length === 0) {
      console.warn('deleteWhere called with empty or invalid filter. Aborting deletion.');
      return;
    }
    if (!this.isInitialized()) throw new Error('IndexManager not initialized.');
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory: {
          const idsToDelete: string[] = [];
          for (const [id, item] of inMemoryStore.entries()) {
            if (this.matchesFilter(item, filter)) {
              idsToDelete.push(id);
            }
          }
          if (idsToDelete.length > 0) {
            this.deleteItems(idsToDelete); // Reuse existing deleteItems logic
            console.log(`[InMemory] Deleted ${idsToDelete.length} items matching filter.`);
          } else {
            console.log('[InMemory] No items found matching filter for deletion.');
          }
          break;
        }
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          let pineconeFilter: Record<string, unknown> | undefined = undefined;
          if (filter) {
            pineconeFilter = {};
            for (const key in filter) {
              pineconeFilter[key] = { $eq: filter[key] };
            }
          }
          try {
              if (pineconeFilter) {
                 await ns.deleteMany({ filter: pineconeFilter });
                 console.log('[Pinecone] Attempted deletion for items matching filter:', filter);
              } else {
                 console.warn('[Pinecone] deleteWhere called without a filter, cannot delete.');
              }
          } catch (pineconeDeleteError) {
              console.warn(`[Pinecone] deleteMany with filter failed (may not be supported or filter syntax incorrect). Filter: ${JSON.stringify(filter)}, Error: ${pineconeDeleteError}`);
          }
          break;
        }
        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
          const whereFilter = convertFilterToChromaWhere(filter);
          await this.chromaCollection.delete({ where: whereFilter });
          console.log('[ChromaDB] Attempted deletion for items matching filter:', filter);
          break;
        }
        default: {
          const exhaustiveCheck: never = this.config;
          throw new Error(`Unsupported vector DB provider for deleteWhere: ${exhaustiveCheck}`);
        }
      }
    } catch (error) {
      throw new Error(`deleteWhere failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  async queryIndex(
    queryVector: EmbeddingVector,
    topK = 5,
    filter?: Record<string, string | number | boolean>,
  ): Promise<QueryResult[]> {
    if (!this.isInitialized()) throw new Error('IndexManager not initialized.');
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory: {
          const results: QueryResult[] = [];
          for (const item of inMemoryStore.values()) {
            if (filter && !this.matchesFilter(item, filter)) {
              continue;
            }
            const score = this.cosineSimilarity(queryVector, item.vector);
            results.push({ item, score });
          }
          results.sort((a, b) => b.score - a.score);
          return results.slice(0, topK);
        }
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          let pineconeFilter: Record<string, unknown> | undefined = undefined;
          if (filter) {
            pineconeFilter = {};
            for (const key in filter) {
              pineconeFilter[key] = { $eq: filter[key] };
            }
          }
          const queryResponse = await ns.query({
            vector: queryVector,
            topK: topK,
            filter: pineconeFilter,
            includeMetadata: true,
          });
          const mappedResults: QueryResult[] = (queryResponse.matches || []).map((match) => ({
            item: {
              id: match.id,
              content: '', // Pinecone query doesn't return content
              metadata: match.metadata || {},
            } as IndexedItem,
            score: match.score || 0,
          }));
          return mappedResults;
        }
        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
          const whereFilter = filter ? convertFilterToChromaWhere(filter) : undefined;
          const queryResults = await this.chromaCollection.query({
            queryEmbeddings: [queryVector],
            nResults: topK,
            where: whereFilter,
            include: [IncludeEnum.Metadatas, IncludeEnum.Documents, IncludeEnum.Distances],
          });
          const mappedResults: QueryResult[] = [];
          if (queryResults.ids && queryResults.ids.length > 0) {
            for (let i = 0; i < queryResults.ids[0].length; i++) {
              const id = queryResults.ids[0][i];
              const distance = queryResults.distances?.[0]?.[i];
              const metadata = queryResults.metadatas?.[0]?.[i] as
                | Record<string, unknown>
                | undefined;
              const document = queryResults.documents?.[0]?.[i];
              const item: Omit<IndexedItem, 'vector'> = {
                id: id,
                content: document || '',
                metadata: metadata,
              };
              mappedResults.push({
                item: item as IndexedItem,
                score: distance !== undefined ? 1 - distance : 0, // Convert distance to similarity score
              });
            }
          }
          return mappedResults;
        }
        default: {
          const exhaustiveCheck: never = this.config;
          throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
      }
    } catch (error) {
      throw new Error(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private matchesFilter(item: IndexedItem, filter: Record<string, unknown>): boolean {
    for (const key in filter) {
      const filterValue = filter[key];
      // Check top-level properties first (like id, content - though filtering by content is unlikely)
      // biome-ignore lint/suspicious/noExplicitAny: Dynamically checking top-level keys
      if (key in item && (item as any)[key] === filterValue) {
        continue;
      }
      // Then check metadata using Object.hasOwn for safety
      if (
        item.metadata &&
        Object.hasOwn(item.metadata, key) &&
        item.metadata[key] === filterValue
      ) {
        continue;
      }
      // If neither matches, the filter fails for this item
      return false;
    }
    return true; // All filter conditions matched
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magnitudeA += vecA[i] * vecA[i];
      magnitudeB += vecB[i] * vecB[i];
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
