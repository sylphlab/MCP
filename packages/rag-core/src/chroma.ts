import path from 'node:path';
import { ChromaClient, type Collection, type IEmbeddingFunction, type Where } from 'chromadb'; // Import Chroma types

// Configuration for ChromaDB
const DEFAULT_CHROMA_PATH = './.mcp/chroma_db';
const COLLECTION_NAME = process.env.CHROMA_COLLECTION || 'mcp_rag_collection'; // Allow overriding collection name

let client: ChromaClient | null = null;
let dbPath: string | null = null; // Store the path used for initialization
let collectionInstance: Collection | null = null; // Cache collection instance

/**
 * Initializes the ChromaDB client for local persistence.
 * @param chromaDbPath The path to the directory for the persistent database. Defaults to DEFAULT_CHROMA_PATH relative to project root.
 */
async function initChromaClient(projectRoot: string, chromaDbPath?: string): Promise<ChromaClient> {
  const effectiveDbPath = path.resolve(projectRoot, chromaDbPath || DEFAULT_CHROMA_PATH); // Resolve path relative to project root

  if (client && dbPath !== effectiveDbPath) {
    client = null;
    collectionInstance = null; // Reset collection cache too
  }
  dbPath = effectiveDbPath;

  if (!client) {
    try {
      client = new ChromaClient({ path: dbPath });
    } catch (_error) {
      throw new Error('ChromaDB client initialization failed');
    }
  }
  return client;
}

/**
 * Gets or creates the ChromaDB collection for RAG.
 * Requires an embedding function compatible with ChromaDB.
 * @param embeddingFunction The function to use for generating embeddings.
 * @param projectRoot The root directory of the project.
 * @param chromaDbPath Optional path for the database directory.
 */
export async function getRagCollection(
  embeddingFunction: IEmbeddingFunction,
  projectRoot: string,
  chromaDbPath?: string,
): Promise<Collection> {
  const chromaClient = await initChromaClient(projectRoot, chromaDbPath);

  if (!collectionInstance || client !== chromaClient) {
    // Check if client was re-initialized
    try {
      collectionInstance = await chromaClient.getOrCreateCollection({
        name: COLLECTION_NAME,
        embeddingFunction: embeddingFunction, // Pass embedding function here
        // metadata: { "hnsw:space": "cosine" } // Example metadata if needed
      });
    } catch (error) {
      throw new Error(
        `Failed to get/create collection: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return collectionInstance;
}

// Helper function to convert simple filter to ChromaDB 'where' format
// TODO: Expand this to support more complex operators ($ne, $gt, $in etc.) if needed
export function convertFilterToChromaWhere(
  filter: Record<string, string | number | boolean>,
): Where {
  const where: Where = {};
  for (const key in filter) {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamically assigning keys based on filter object for ChromaDB Where type
    (where as any)[key] = { $eq: filter[key] }; // Default to $eq
  }
  return where;
}

// Removed redundant export statement
