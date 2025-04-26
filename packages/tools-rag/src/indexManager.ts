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
          const clientPath = this.config.host || this.config.path;
          if (!clientPath) {
            throw new Error('ChromaDB config requires either a "path" or a "host".');
          }
          console.log(`[IndexManager] Attempting to initialize ChromaClient with path/host: ${clientPath}`);
          try {
            this.chromaClient = new ChromaClient({ path: clientPath });
            console.log('[IndexManager] ChromaClient instance created successfully.');
            console.log(`[IndexManager] Attempting to get/create collection: ${this.config.collectionName}`);
            this.chromaCollection = await this.chromaClient.getOrCreateCollection({
              name: this.config.collectionName,
              embeddingFunction: this.embeddingFn,
            });
            console.log(`[IndexManager] Chroma collection '${this.config.collectionName}' obtained.`);
          } catch (chromaError) {
            console.error('[IndexManager] Error during ChromaClient/Collection initialization:', chromaError);
            throw chromaError;
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
          case VectorDbProvider.InMemory: return true;
          case VectorDbProvider.ChromaDB: return !!this.chromaCollection;
          case VectorDbProvider.Pinecone: return !!this.pineconeIndex;
          default: return false;
      }
  }

  /**
   * Instance method to get status (count and name) of the managed collection/index.
   */
  public async getStatus(): Promise<{ count: number; name: string }> {
    if (!this.isInitialized()) {
        throw new Error('IndexManager not initialized. Call initialize() first.');
    }
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory:
          return { count: inMemoryStore.size, name: 'in-memory-store' };
        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) throw new Error('ChromaDB collection not available.');
          const count = await this.chromaCollection.count();
          return { count, name: this.chromaCollection.name };
        }
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not available.');
          const stats = await this.pineconeIndex.describeIndexStats();
          const namespace = this.config.namespace || '';
          const count = stats.namespaces?.[namespace]?.recordCount || 0;
          return { count, name: `${this.config.indexName}${namespace ? `[${namespace}]` : ''}` };
        }
        default: {
          const exhaustiveCheck: never = this.config;
          throw new Error(`Unsupported vector DB provider for getStatus: ${exhaustiveCheck}`);
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
          for (const item of items) { inMemoryStore.set(item.id, item); }
          break;
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          const batchSize = 100; // Pinecone recommended batch size
          for (let i = 0; i < items.length; i += batchSize) {
            const batchItems = items.slice(i, i + batchSize);
            const vectorsToUpsert = batchItems.map((item) => ({
              id: item.id,
              values: item.vector,
              metadata: item.metadata as RecordMetadata, // Ensure metadata is compatible
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
                // Filter out non-primitive types for ChromaDB metadata
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
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
          const results = await this.chromaCollection.get({ include: [] }); // Fetch only IDs
          return results.ids;
        }
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          let allIds: string[] = [];
          let nextToken: string | undefined = undefined;
          const limit = 1000; // Max limit for listPaginated
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

  /**
   * Retrieves the IDs and specific metadata (like fileMtime) for all chunks associated with a given file path.
   * @param filePath - The relative file path to query for.
   * @returns A Map where keys are chunk IDs and values are their metadata objects, or null if retrieval fails.
   */
  async getChunksMetadataByFilePath(filePath: string): Promise<Map<string, Record<string, any>> | null> {
      if (!this.isInitialized()) {
          console.error('[IndexManager] Cannot get metadata, not initialized.');
          return null;
      }
      const results = new Map<string, Record<string, any>>();
      try {
          switch (this.config.provider) {
              case VectorDbProvider.InMemory:
                  for (const [id, item] of inMemoryStore.entries()) {
                      if (item.metadata?.filePath === filePath) {
                          results.set(id, item.metadata || {});
                      }
                  }
                  break;
              case VectorDbProvider.ChromaDB: {
                  if (!this.chromaCollection) return null;
                  const response = await this.chromaCollection.get({
                      where: { filePath: filePath },
                      include: [IncludeEnum.Metadatas],
                  });
                  if (response.ids && response.metadatas) {
                      for (let i = 0; i < response.ids.length; i++) {
                          results.set(response.ids[i], response.metadatas[i] || {});
                      }
                  }
                  break;
              }
              case VectorDbProvider.Pinecone: {
                  if (!this.pineconeIndex) return null;
                  const ns = this.pineconeIndex.namespace(this.config.namespace || '');
                  const dummyVector = new Array(1536).fill(0); // Adjust dimension if needed
                  const limit = 1000;

                  const queryResponse = await ns.query({
                      vector: dummyVector,
                      topK: limit,
                      filter: { filePath: { '$eq': filePath } },
                      includeMetadata: true,
                      includeValues: false,
                  });

                  if (queryResponse.matches) {
                      for (const match of queryResponse.matches) {
                          results.set(match.id, match.metadata || {});
                      }
                  }
                  if (queryResponse.matches?.length === limit) {
                      console.warn(`[Pinecone] Reached query limit (${limit}) when fetching metadata for ${filePath}. Some chunks might be missing.`);
                  }
                  break;
              }
              default: {
                  const exhaustiveCheck: never = this.config;
                  console.warn(`[IndexManager] getChunksMetadataByFilePath not implemented for provider: ${(exhaustiveCheck as any)?.provider}`);
                  return null;
              }
          }
          return results;
      } catch (error) {
          console.error(`[IndexManager] Error in getChunksMetadataByFilePath for ${filePath}:`, error);
          return null;
      }
  }

  /**
   * Retrieves the last known modification time (mtime) for each unique file path present in the index.
   * @returns A Map where keys are file paths and values are the latest mtime (in milliseconds) found for that path.
   */
  async getAllFileStates(): Promise<Map<string, number>> {
    if (!this.isInitialized()) {
      throw new Error('IndexManager not initialized.');
    }
    const fileStates = new Map<string, number>();

    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory: {
          for (const item of inMemoryStore.values()) {
            const filePath = item.metadata?.filePath as string | undefined;
            const mtime = item.metadata?.fileMtime as number | undefined;
            if (filePath && typeof mtime === 'number') {
              const currentMtime = fileStates.get(filePath) ?? -1;
              if (mtime > currentMtime) {
                fileStates.set(filePath, mtime);
              }
            }
          }
          break;
        }
        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
          // Fetch all metadatas. This might be inefficient for very large collections.
          // Consider pagination or more targeted queries if performance becomes an issue.
          const results = await this.chromaCollection.get({ include: [IncludeEnum.Metadatas] });
          if (results.metadatas) {
            for (const metadata of results.metadatas) {
              if (metadata) {
                const filePath = metadata.filePath as string | undefined;
                const mtime = metadata.fileMtime as number | undefined;
                if (filePath && typeof mtime === 'number') {
                  const currentMtime = fileStates.get(filePath) ?? -1;
                  if (mtime > currentMtime) {
                    fileStates.set(filePath, mtime);
                  }
                }
              }
            }
          }
          break;
        }
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          console.warn('[Pinecone] getAllFileStates requires listing all IDs and fetching metadata, which can be slow for large indexes.');

          let nextToken: string | undefined = undefined;
          const listLimit = 1000;
          const fetchLimit = 1000;

          do {
            const listResponse = await ns.listPaginated({ limit: listLimit, paginationToken: nextToken });
            const vectorIds = (listResponse.vectors?.map(v => v.id) || []).filter((id): id is string => !!id);

            if (vectorIds.length > 0) {
              for (let i = 0; i < vectorIds.length; i += fetchLimit) {
                const idBatch = vectorIds.slice(i, i + fetchLimit);
                const fetchResponse = await ns.fetch(idBatch);
                for (const id in fetchResponse.records) {
                  const record = fetchResponse.records[id];
                  if (record.metadata) {
                    const filePath = record.metadata.filePath as string | undefined;
                    const mtime = record.metadata.fileMtime as number | undefined;
                    if (filePath && typeof mtime === 'number') {
                      const currentMtime = fileStates.get(filePath) ?? -1;
                      if (mtime > currentMtime) {
                        fileStates.set(filePath, mtime);
                      }
                    }
                  }
                }
              }
            }
            nextToken = listResponse.pagination?.next;
          } while (nextToken);
          break;
        }
        default: {
          const exhaustiveCheck: never = this.config;
          throw new Error(`Unsupported vector DB provider for getAllFileStates: ${exhaustiveCheck}`);
        }
      }
      return fileStates;
    } catch (error) {
      throw new Error(`getAllFileStates failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  async deleteItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    if (!this.isInitialized()) throw new Error('IndexManager not initialized.');
    try {
      switch (this.config.provider) {
        case VectorDbProvider.InMemory: {
          let _deletedCount = 0;
          for (const id of ids) { if (inMemoryStore.delete(id)) { _deletedCount++; } }
          break;
        }
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');
          const batchSize = 1000; // Pinecone delete limit
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
   * Supports simple equality filters and $ne (not equal) for syncSessionId.
   * @param filter - A filter object (e.g., { filePath: 'path/to/file.ts', syncSessionId: { '$ne': '...' } })
   */
  async deleteWhere(filter: Record<string, any>): Promise<void> { // Allow complex filter values
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
            if (this.matchesFilter(item, filter)) { // Use updated matchesFilter
              idsToDelete.push(id);
            }
          }
          if (idsToDelete.length > 0) {
            await this.deleteItems(idsToDelete); // Await deletion
            console.log(`[InMemory] Deleted ${idsToDelete.length} items matching filter.`);
          } else {
            console.log('[InMemory] No items found matching filter for deletion.');
          }
          break;
        }
        case VectorDbProvider.Pinecone: {
          if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
          const ns = this.pineconeIndex.namespace(this.config.namespace || '');

          // Convert filter to Pinecone syntax, supporting $ne
          const pineconeFilter: Record<string, any> = {};
          for (const key in filter) {
              const filterValue = filter[key];
              if (typeof filterValue === 'object' && filterValue !== null && filterValue.$ne !== undefined) {
                  pineconeFilter[key] = { '$ne': filterValue.$ne };
              } else if (typeof filterValue === 'string' || typeof filterValue === 'number' || typeof filterValue === 'boolean') {
                  pineconeFilter[key] = { '$eq': filterValue };
              } else {
                  console.warn(`[Pinecone] Unsupported filter type for key '${key}' in deleteWhere. Skipping key.`);
              }
          }

          if (Object.keys(pineconeFilter).length === 0) {
            console.warn('[Pinecone] deleteWhere filter conversion resulted in empty filter. Aborting deletion.');
            break;
          }

          // Workaround: List all IDs, fetch metadata, filter client-side, then delete by ID
          console.log('[Pinecone] Listing/Fetching IDs matching filter for deletion:', pineconeFilter);
          try {
            // const dummyVector = new Array(1536).fill(0); // Unused
            const idsToDelete: string[] = []; // Use const
            let nextToken: string | undefined = undefined;
            const listLimit = 1000;

            do {
                const listResponse = await ns.listPaginated({ limit: listLimit, paginationToken: nextToken });
                // Ensure vectorIds only contains strings
                const vectorIds = (listResponse.vectors?.map(v => v.id) || []).filter((id): id is string => !!id);
                if (vectorIds.length > 0) {
                    // Fetch metadata for the listed IDs in batches
                    const fetchLimit = 1000;
                    for (let i = 0; i < vectorIds.length; i += fetchLimit) {
                        const idBatch = vectorIds.slice(i, i + fetchLimit);
                        const fetchResponse = await ns.fetch(idBatch); // Now guaranteed string[]
                        for (const id in fetchResponse.records) {
                            const record = fetchResponse.records[id];
                            // Client-side filter application
                            if (record.metadata && this.matchesPineconeFilter(record.metadata, pineconeFilter)) {
                                idsToDelete.push(id);
                            }
                        }
                    }
                }
                nextToken = listResponse.pagination?.next;
            } while (nextToken);


            if (idsToDelete.length > 0) {
                console.log(`[Pinecone] Found ${idsToDelete.length} IDs matching filter. Deleting...`);
                const batchSize = 1000;
                for (let i = 0; i < idsToDelete.length; i += batchSize) {
                    const batch = idsToDelete.slice(i, i + batchSize);
                    await ns.deleteMany(batch);
                }
                console.log(`[Pinecone] Finished deleting ${idsToDelete.length} items.`);
            } else {
                console.log('[Pinecone] No items found matching the filter to delete.');
            }
          } catch (queryOrDeleteError) {
              console.error(`[Pinecone] Error during list/fetch/delete process for filter ${JSON.stringify(pineconeFilter)}:`, queryOrDeleteError);
          }
          break;
        }
        case VectorDbProvider.ChromaDB: {
          if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
          // Use the updated convertFilterToChromaWhere which should handle $ne
          const whereFilter = convertFilterToChromaWhere(filter);
          if (!whereFilter || (Object.keys(whereFilter).length === 0 && !whereFilter.$and && !whereFilter.$or)) { // Check for empty filter
              console.warn('[ChromaDB] deleteWhere filter conversion resulted in empty filter. Aborting deletion.');
              break;
          }
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
            if (filter && !this.matchesFilter(item, filter)) { continue; }
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
            for (const key in filter) { pineconeFilter[key] = { $eq: filter[key] }; }
          }
          const queryResponse = await ns.query({
            vector: queryVector,
            topK: topK,
            filter: pineconeFilter,
            includeMetadata: true,
            includeValues: false, // Don't need vector values in result
          });
          const mappedResults: QueryResult[] = (queryResponse.matches || []).map((match) => ({
            item: {
              id: match.id,
              content: (match.metadata?.content as string) || '', // Reconstruct from metadata
              startPosition: (match.metadata?.startPosition as number) ?? -1,
              endPosition: (match.metadata?.endPosition as number) ?? -1,
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
              const metadata = queryResults.metadatas?.[0]?.[i] as Record<string, unknown> | undefined;
              const document = queryResults.documents?.[0]?.[i];
              const item: Omit<IndexedItem, 'vector'> = {
                id: id,
                content: document || '',
                metadata: metadata,
                startPosition: (metadata?.startPosition as number) ?? -1,
                endPosition: (metadata?.endPosition as number) ?? -1,
              };
              mappedResults.push({
                item: item as IndexedItem,
                score: distance !== undefined ? 1 - distance : 0, // Convert distance to similarity
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

  /** Checks if an item's metadata matches a simple equality filter or $ne filter. */
  private matchesFilter(item: IndexedItem, filter: Record<string, any>): boolean {
    for (const key in filter) {
      const filterValueOrCondition = filter[key];
      const itemValue = item.metadata?.[key];

      if (typeof filterValueOrCondition === 'object' && filterValueOrCondition !== null && filterValueOrCondition.$ne !== undefined) {
        // Handle $ne operator
        if (itemValue === filterValueOrCondition.$ne) {
          return false; // Fails if value IS equal to the $ne condition
        }
      } else {
        // Handle simple equality
        if (itemValue !== filterValueOrCondition) {
          return false; // Fails if value is not equal
        }
      }
    }
    return true; // All filter conditions matched
  }

  /** Helper for client-side filtering for Pinecone deleteWhere workaround */
  private matchesPineconeFilter(metadata: RecordMetadata | undefined, filter: Record<string, any>): boolean {
      if (!metadata) return false; // No metadata cannot match
      for (const key in filter) {
          const filterValueOrCondition = filter[key];
          const itemValue = metadata[key]; // Pinecone metadata values are primitives

          if (typeof filterValueOrCondition === 'object' && filterValueOrCondition !== null && filterValueOrCondition.$ne !== undefined) {
              if (itemValue === filterValueOrCondition.$ne) return false;
          } else {
              if (itemValue !== filterValueOrCondition) return false;
          }
      }
      return true;
  }


  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) { return 0; }
    let dotProduct = 0; let magnitudeA = 0; let magnitudeB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magnitudeA += vecA[i] * vecA[i];
      magnitudeB += vecB[i] * vecB[i];
    }
    magnitudeA = Math.sqrt(magnitudeA); magnitudeB = Math.sqrt(magnitudeB);
    if (magnitudeA === 0 || magnitudeB === 0) { return 0; }
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
