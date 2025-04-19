import { z } from 'zod';
import { Chunk } from './types.js';
import { EmbeddingVector } from './embedding.js';
import { ChromaClient, Collection, Where, IncludeEnum, Metadata } from 'chromadb'; // Import ChromaDB types

// TODO: Define specific vector database providers (e.g., Pinecone, ChromaDB, in-memory)
export enum VectorDbProvider {
  InMemory = 'in-memory',
  Pinecone = 'pinecone', // Placeholder
  ChromaDB = 'chromadb',
}

// Define schemas for each provider's specific config
const InMemoryConfigSchema = z.object({
  provider: z.literal(VectorDbProvider.InMemory),
  // No specific config needed for basic in-memory
});

const PineconeConfigSchema = z.object({
  provider: z.literal(VectorDbProvider.Pinecone),
  apiKey: z.string().min(1, "Pinecone API key is required"),
  environment: z.string().min(1, "Pinecone environment is required"),
  indexName: z.string().min(1, "Pinecone index name is required"),
  // Add other Pinecone options like topK namespace etc. if needed
});

const ChromaDBConfigSchema = z.object({
  provider: z.literal(VectorDbProvider.ChromaDB),
  path: z.string().optional(), // Path for persistent storage
  host: z.string().optional(), // Host if running client/server mode
  port: z.number().optional(), // Port if running client/server mode
  collectionName: z.string().default('mcp_rag_collection'),
  // Add auth, headers etc. if needed
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

/**
 * Represents an item stored in the vector database.
 */
export interface IndexedItem extends Chunk {
  id: string; // Unique identifier for the item
  vector: EmbeddingVector;
}

/**
 * Represents the result of a similarity search.
 */
export interface QueryResult {
  item: IndexedItem;
  score: number; // Similarity score
}

// Placeholder for the in-memory store
let inMemoryStore: Map<string, IndexedItem> = new Map();

/**
 * Manages interactions with a vector database.
 */
export class IndexManager {
  private config: VectorDbConfig;
  private client: ChromaClient | null = null; // Chroma client instance
  private collection: Collection | null = null; // Chroma collection instance

  // Constructor needs to be async to initialize client/collection
  private constructor(config: VectorDbConfig) {
    // TODO: Add validation step? Or assume valid config is passed?
    // const validation = VectorDbConfigSchema.safeParse(config);
    // if (!validation.success) throw new Error(`Invalid VectorDbConfig: ${validation.error.message}`);
    // this.config = validation.data;
    this.config = config;
    console.log(`Initializing IndexManager with provider: ${this.config.provider}`);
    // Initialization logic moved to static create method
  }

  // Static async factory method for initialization
  public static async create(config: VectorDbConfig): Promise<IndexManager> {
    const manager = new IndexManager(config);
    await manager.initialize();
    return manager;
  }

  private async initialize(): Promise<void> {
     try {
        switch (this.config.provider) {
          case VectorDbProvider.InMemory:
            console.log('Using In-Memory vector store.');
            // Optionally clear: inMemoryStore.clear();
            break;
          case VectorDbProvider.Pinecone:
            // TODO: Initialize Pinecone client
            console.error('Pinecone initialization not implemented.');
            throw new Error('Pinecone provider not yet implemented.');
          case VectorDbProvider.ChromaDB:
            console.log('Initializing ChromaDB client...');
            const chromaConfig: { path?: string; host?: string; port?: number } = {};
            if (this.config.path) chromaConfig.path = this.config.path;
            if (this.config.host) chromaConfig.host = this.config.host;
            // ChromaClient constructor doesn't take port directly, host includes it or uses default
            this.client = new ChromaClient(chromaConfig);
            // TODO: Add heartbeat check? client.heartbeat()
            console.log(`Getting or creating ChromaDB collection: ${this.config.collectionName}`);
            this.collection = await this.client.getOrCreateCollection({
              name: this.config.collectionName,
              // TODO: Add metadata for embedding function if needed by ChromaDB?
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


  /**
   * Adds or updates items in the vector index.
   * @param items An array of items containing chunks, vectors, and IDs.
   */
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
            break; // Added break
          case VectorDbProvider.Pinecone:
            // TODO: Implement Pinecone upsert logic
            console.error('Pinecone upsert not implemented.');
            throw new Error('Pinecone provider not yet implemented.');
          case VectorDbProvider.ChromaDB:
            if (!this.collection) throw new Error('ChromaDB collection not initialized.');
            // Prepare data for ChromaDB upsert
            const ids = items.map(item => item.id);
            const embeddings = items.map(item => item.vector);
            // Filter metadata to only include primitive types allowed by ChromaDB
            const metadatas = items.map(item => {
                const filteredMeta: Metadata = {};
                if (item.metadata) {
                    for (const key in item.metadata) {
                        const value = item.metadata[key];
                        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                            filteredMeta[key] = value;
                        } else {
                            // Optionally log warning about skipped metadata
                            // console.warn(`Skipping non-primitive metadata key '${key}' for item ID '${item.id}'`);
                        }
                    }
                }
                return filteredMeta;
            });
            const documents = items.map(item => item.content);

            await this.collection.upsert({ ids, embeddings, metadatas, documents });
            console.log(`Upserted ${items.length} items to ChromaDB collection '${this.config.collectionName}'.`);
            break; // Added break
          default:
            const exhaustiveCheck: never = this.config;
            throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
    } catch (error) {
        console.error(`Error during upsertItems with provider ${this.config.provider}:`, error);
        // TODO: Consider returning success/failure status or IDs of failed items.
        throw new Error(`Upsert failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deletes items from the vector index by their IDs.
   * @param ids An array of item IDs to delete.
   */
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
            break; // Added break
          case VectorDbProvider.Pinecone:
            // TODO: Implement Pinecone delete logic
            console.error('Pinecone delete not implemented.');
            throw new Error('Pinecone provider not yet implemented.');
          case VectorDbProvider.ChromaDB:
             if (!this.collection) throw new Error('ChromaDB collection not initialized.');
             // ChromaDB delete handles non-existent IDs gracefully
             await this.collection.delete({ ids });
             console.log(`Attempted to delete ${ids.length} items from ChromaDB collection '${this.config.collectionName}'.`);
             break; // Added break
          default:
            const exhaustiveCheck: never = this.config;
            throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
    } catch (error) {
        console.error(`Error during deleteItems with provider ${this.config.provider}:`, error);
        // TODO: Handle cases where some IDs might not exist - should it throw, return status?
        throw new Error(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Queries the vector index for items similar to the query vector.
   * @param queryVector The vector to search for.
   * @param topK The number of top similar items to return.
   * @param filter Optional metadata filter.
   * @returns A promise that resolves to an array of QueryResult objects.
   */
  async queryIndex(
    queryVector: EmbeddingVector,
    topK: number = 5,
    filter?: Record<string, string | number | boolean> // Basic filter type
  ): Promise<QueryResult[]> {
    console.log(`Querying index for top ${topK} results...`);

    try {
        switch (this.config.provider) {
          case VectorDbProvider.InMemory: { // Added block scope
            const results: QueryResult[] = [];
            for (const item of inMemoryStore.values()) {
               if (filter && !this.matchesFilter(item.metadata, filter)) {
                  continue;
               }
               const score = this.cosineSimilarity(queryVector, item.vector);
               results.push({ item, score });
            }
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, topK);
          } // End InMemory case
          case VectorDbProvider.Pinecone:
            // TODO: Implement Pinecone query logic
            console.error('Pinecone query not implemented.');
            throw new Error('Pinecone provider not yet implemented.');
          case VectorDbProvider.ChromaDB: { // Added block scope
             if (!this.collection) throw new Error('ChromaDB collection not initialized.');

             const whereFilter = filter ? convertFilterToChromaWhere(filter) : undefined; // Use helper
             console.log('ChromaDB where filter:', whereFilter);

             const queryResults = await this.collection.query({
                queryEmbeddings: [queryVector],
                nResults: topK,
                where: whereFilter,
                // Use IncludeEnum members
                include: [IncludeEnum.Metadatas, IncludeEnum.Documents, IncludeEnum.Distances],
             });

             // Map ChromaDB results to QueryResult[]
             // Note: Chroma returns distances (lower is better), convert to similarity score (e.g., 1 - distance)
             const mappedResults: QueryResult[] = [];
             if (queryResults.ids && queryResults.ids.length > 0) {
                for (let i = 0; i < queryResults.ids[0].length; i++) {
                   const id = queryResults.ids[0][i];
                   const distance = queryResults.distances?.[0]?.[i];
                   const metadata = queryResults.metadatas?.[0]?.[i] as Record<string, unknown> | undefined;
                   const document = queryResults.documents?.[0]?.[i];

                   // Reconstruct IndexedItem (vector is not returned by query)
                   // We might need to fetch the vector separately if needed downstream,
                   // or accept that QueryResult won't have the vector.
                   const item: Omit<IndexedItem, 'vector'> = {
                      id: id,
                      content: document || '', // Use document as content
                      metadata: metadata,
                   };

                   mappedResults.push({
                      item: item as IndexedItem, // Cast needed as vector is missing
                      score: distance !== undefined ? 1 - distance : 0, // Example similarity conversion
                   });
                }
                
                // Note: convertFilterToChromaWhere moved to module scope below
             }
             return mappedResults;
          } // End ChromaDB case
          default:
            const exhaustiveCheck: never = this.config;
            throw new Error(`Unsupported vector DB provider: ${exhaustiveCheck}`);
        }
    } catch (error) {
        console.error(`Error during queryIndex with provider ${this.config.provider}:`, error);
        // TODO: Add more specific error handling
        throw new Error(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper for in-memory filtering (basic implementation)
  private matchesFilter(metadata: Record<string, unknown> | undefined, filter: Record<string, unknown>): boolean {
     if (!metadata) return false;
     for (const key in filter) {
        if (!metadata.hasOwnProperty(key) || metadata[key] !== filter[key]) {
           return false;
        }
     }
     return true;
  }


  // Helper for cosine similarity (ensure vectors are non-zero)
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) {
      return 0; // Or throw error
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
      return 0; // Avoid division by zero
    }
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Helper function to convert simple filter to ChromaDB 'where' format
// Moved to module scope
// TODO: Expand this to support more complex operators ($ne, $gt, $in etc.) if needed
function convertFilterToChromaWhere(filter: Record<string, string | number | boolean>): Where {
   const where: Where = {};
   // Simple equality check for now
   // TODO: Add support for ChromaDB operators like $eq, $ne, etc. if needed
   // Example: if filter key ends with '_$ne', create { key: { $ne: value } }
   for (const key in filter) {
      // Use type assertion to bypass strict index signature check
      (where as any)[key] = { $eq: filter[key] }; // Default to $eq
   }
   return where;
}