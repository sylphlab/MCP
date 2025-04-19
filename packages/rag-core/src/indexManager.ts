import { z } from 'zod';
import { Chunk } from './types.js';
import { EmbeddingVector, IEmbeddingFunction } from './embedding.js'; // Import IEmbeddingFunction
import { ChromaClient, Collection, Where, IncludeEnum, Metadata } from 'chromadb';
import { Pinecone, Index as PineconeIndex, RecordMetadata } from '@pinecone-database/pinecone';
import path from 'node:path';
import { convertFilterToChromaWhere } from './chroma.js';

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
  apiKey: z.string().min(1, "Pinecone API key is required"),
  indexName: z.string().min(1, "Pinecone index name is required"),
  namespace: z.string().optional(),
});

const ChromaDBConfigSchema = z.object({
  provider: z.literal(VectorDbProvider.ChromaDB),
  path: z.string().optional(),
  host: z.string().optional(),
  collectionName: z.string().default('mcp_rag_collection'),
});

// Use discriminated union for the main config schema
export const VectorDbConfigSchema = z.discriminatedUnion("provider", [
  InMemoryConfigSchema,
  PineconeConfigSchema,
  ChromaDBConfigSchema,
]);

// Default config (using InMemory)
const defaultVectorDbConfig = { provider: VectorDbProvider.InMemory } as const;

export type VectorDbConfig = z.infer<typeof VectorDbConfigSchema>;

export interface IndexedItem extends Chunk {
  id: string;
  vector: EmbeddingVector;
}

export interface QueryResult {
  item: IndexedItem;
  score: number;
}

let inMemoryStore: Map<string, IndexedItem> = new Map();

export class IndexManager {
  private config: VectorDbConfig;
  private chromaClient: ChromaClient | null = null;
  private chromaCollection: Collection | null = null;
  private pineconeClient: Pinecone | null = null;
  private pineconeIndex: PineconeIndex | null = null;
  private embeddingFn: IEmbeddingFunction | null = null; // Store embedding function

  private constructor(config: VectorDbConfig) {
    this.config = config;
    console.log(`Initializing IndexManager with provider: ${this.config.provider}`);
  }

  /** @internal */
  public static _resetInMemoryStoreForTesting(): void {
     console.warn('[TESTING] Resetting inMemoryStore');
     inMemoryStore.clear();
  }

  // Modified create to accept embedding function
  public static async create(config: VectorDbConfig, embeddingFn?: IEmbeddingFunction): Promise<IndexManager> {
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
            console.log('Using In-Memory vector store.');
            break;
          case VectorDbProvider.Pinecone:
            console.log('Initializing Pinecone client...');
            if (!this.config.apiKey || !this.config.indexName) {
                 throw new Error('Pinecone config requires apiKey and indexName.');
            }
            this.pineconeClient = new Pinecone({ apiKey: this.config.apiKey });
            this.pineconeIndex = this.pineconeClient.index(this.config.indexName);
            console.log(`Pinecone client initialized. Using index: ${this.config.indexName}`);
            break;
          case VectorDbProvider.ChromaDB:
            console.log('Initializing ChromaDB client...');
            if (!this.embeddingFn) {
                throw new Error('ChromaDB provider requires an embedding function to be provided during IndexManager creation.');
            }
            const chromaConfig: { path?: string; host?: string } = {};
            if (this.config.path) chromaConfig.path = this.config.path;
            if (this.config.host) chromaConfig.host = this.config.host;
            this.chromaClient = new ChromaClient(chromaConfig);
            console.log(`Getting or creating ChromaDB collection: ${this.config.collectionName}`);
            this.chromaCollection = await this.chromaClient.getOrCreateCollection({
              name: this.config.collectionName,
              embeddingFunction: this.embeddingFn, // Use the stored function
            });
            console.log('ChromaDB client and collection initialized.');
            break;
          default:
            const exhaustiveCheck: never = this.config;
            throw new Error(`Unhandled vector DB provider during initialization: ${exhaustiveCheck}`);
        }
     } catch (error) {
        console.error(`Failed to initialize IndexManager with provider ${this.config.provider}:`, error);
        throw new Error(`IndexManager initialization failed: ${error instanceof Error ? error.message : String(error)}`);
     }
  }

  async upsertItems(items: IndexedItem[]): Promise<void> {
    if (items.length === 0) return;
    console.log(`Upserting ${items.length} items...`);
    try {
        switch (this.config.provider) {
          case VectorDbProvider.InMemory:
            for (const item of items) {
              inMemoryStore.set(item.id, item);
            }
            console.log(`In-memory store size: ${inMemoryStore.size}`);
            break;
          case VectorDbProvider.Pinecone: { // Add block scope
            if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
            const ns = this.pineconeIndex.namespace(this.config.namespace || ''); // Use validated config
            // Batch upsert requests for Pinecone (max 100 vectors or 2MB per request)
            const batchSize = 100; // Pinecone recommended batch size
            for (let i = 0; i < items.length; i += batchSize) {
                const batchItems = items.slice(i, i + batchSize);
                const vectorsToUpsert = batchItems.map(item => ({
                    id: item.id,
                    values: item.vector,
                    metadata: item.metadata as RecordMetadata, // Ensure metadata is compatible
                }));
                await ns.upsert(vectorsToUpsert);
                console.log(`Upserted batch of ${vectorsToUpsert.length} items to Pinecone index '${this.config.indexName}' (namespace: ${this.config.namespace || 'default'}).`);
            }
            break;
          }
          case VectorDbProvider.ChromaDB:
            if (!this.chromaCollection) {
                 throw new Error('ChromaDB collection not initialized.');
            }
            const ids = items.map(item => item.id);
            const embeddings = items.map(item => item.vector);
            const metadatas = items.map(item => {
                const filteredMeta: Metadata = {};
                if (item.metadata) {
                    for (const key in item.metadata) {
                        const value = item.metadata[key];
                        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                            filteredMeta[key] = value;
                        }
                    }
                }
                return filteredMeta;
            });
            const documents = items.map(item => item.content);
            await this.chromaCollection.upsert({ ids, embeddings, metadatas, documents });
            console.log(`Upserted ${items.length} items to ChromaDB collection '${this.config.collectionName}'.`);
            break;
          default:
            const exhaustiveCheck: never = this.config;
            throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
    } catch (error) {
        console.error(`Error during upsertItems with provider ${this.config.provider}:`, error);
        throw new Error(`Upsert failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Get all item IDs from the index
  async getAllIds(): Promise<string[]> {
      console.log(`Getting all IDs for provider: ${this.config.provider}`);
      try {
          switch (this.config.provider) {
              case VectorDbProvider.InMemory:
                  return Array.from(inMemoryStore.keys());

              case VectorDbProvider.ChromaDB:
                  if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
                  console.log(`Fetching all IDs from ChromaDB collection '${this.config.collectionName}'...`);
                  const results = await this.chromaCollection.get({ limit: 1000000 }); // Use a large limit
                  console.log(`Found ${results.ids.length} existing IDs in ChromaDB.`);
                  return results.ids;

              case VectorDbProvider.Pinecone:
                  if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
                  console.log(`Fetching all IDs from Pinecone index '${this.config.indexName}' (namespace: ${this.config.namespace || 'default'})...`);
                  const ns = this.pineconeIndex.namespace(this.config.namespace || '');
                  let allIds: string[] = [];
                  let nextToken: string | undefined = undefined;
                  const limit = 1000; // Max limit per request

                  do {
                      const listResponse = await ns.listPaginated({ limit, paginationToken: nextToken });
                      const ids = listResponse.vectors?.flatMap(v => v.id ? [v.id] : []) || [];
                      allIds = allIds.concat(ids);
                      nextToken = listResponse.pagination?.next;
                      console.log(`Fetched ${ids.length} IDs, nextToken: ${nextToken}`);
                  } while (nextToken);

                  console.log(`Found ${allIds.length} existing IDs in Pinecone.`);
                  return allIds;

              default:
                  return [];
          }
      } catch (error) {
          console.error(`Error during getAllIds with provider ${this.config.provider}:`, error);
          throw new Error(`getAllIds failed: ${error instanceof Error ? error.message : String(error)}`);
      }
  }

  async deleteItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    console.log(`Deleting ${ids.length} items...`);
    try {
        switch (this.config.provider) {
          case VectorDbProvider.InMemory:
            let deletedCount = 0;
            for (const id of ids) {
              if (inMemoryStore.delete(id)) {
                 deletedCount++;
              } else {
                 console.warn(`[InMemory] Attempted to delete non-existent ID: ${id}`);
              }
            }
            console.log(`Deleted ${deletedCount} items. In-memory store size: ${inMemoryStore.size}`);
            break;
          case VectorDbProvider.Pinecone: { // Add block scope
             if (!this.pineconeIndex) throw new Error('Pinecone index not initialized.');
             const ns = this.pineconeIndex.namespace(this.config.namespace || ''); // Use validated config
             // Batch delete requests (max 1000 IDs per request)
             const batchSize = 1000;
             for (let i = 0; i < ids.length; i += batchSize) {
                 const batch = ids.slice(i, i + batchSize);
                 await ns.deleteMany(batch);
                 console.log(`Attempted to delete batch of ${batch.length} items from Pinecone.`);
             }
             break;
           } // Add missing closing brace
           case VectorDbProvider.ChromaDB: { // Add block scope for consistency
              if (!this.chromaCollection) throw new Error('ChromaDB collection not initialized.');
              await this.chromaCollection.delete({ ids });
              console.log(`Attempted to delete ${ids.length} items from ChromaDB collection '${this.config.collectionName}'.`);
             break;
           } // Add closing brace
           default:
            const exhaustiveCheck: never = this.config;
            throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
    } catch (error) {
        console.error(`Error during deleteItems with provider ${this.config.provider}:`, error);
        throw new Error(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async queryIndex(
    queryVector: EmbeddingVector,
    topK: number = 5,
    filter?: Record<string, string | number | boolean>
  ): Promise<QueryResult[]> {
    console.log(`Querying index for top ${topK} results...`);
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
             // Convert generic filter to Pinecone's metadata filter format
             // Example: { genre: 'drama', year: 2020 } -> { genre: {'$eq': 'drama'}, year: {'$eq': 2020} }
             let pineconeFilter: Record<string, any> | undefined = undefined;
             if (filter) {
                 pineconeFilter = {};
                 for (const key in filter) {
                     // Simple equality filter for now, extend as needed
                     pineconeFilter[key] = { '$eq': filter[key] };
                 }
             }
             console.log('Pinecone filter:', pineconeFilter);
             const queryResponse = await ns.query({
                 vector: queryVector,
                 topK: topK,
                 filter: pineconeFilter,
                 includeMetadata: true,
             });
             const mappedResults: QueryResult[] = (queryResponse.matches || []).map(match => ({
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
             console.log('ChromaDB where filter:', whereFilter);
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
                   };
                   mappedResults.push({
                      item: item as IndexedItem,
                      score: distance !== undefined ? 1 - distance : 0, // Convert distance to similarity score
                   });
                }
             }
             return mappedResults;
          }
          default:
            const exhaustiveCheck: never = this.config;
            throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
    } catch (error) {
        console.error(`Error during queryIndex with provider ${this.config.provider}:`, error);
        throw new Error(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private matchesFilter(item: IndexedItem, filter: Record<string, unknown>): boolean {
     for (const key in filter) {
        const filterValue = filter[key];
        // Check top-level properties first (like id, content - though filtering by content is unlikely)
        if (key in item && (item as any)[key] === filterValue) {
           continue;
        }
        // Then check metadata
        if (item.metadata?.hasOwnProperty(key) && item.metadata[key] === filterValue) {
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
