// Import version from package.json
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '@sylphlab/mcp-utils';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Import specific functions and types directly from rag-core
import {
  type Chunk,
  EmbeddingModelProvider,
  type IEmbeddingFunction,
  IndexManager,
  type IndexedItem,
  MockEmbeddingFunction,
  OllamaEmbeddingFunction,
  VectorDbConfigSchema,
  VectorDbProvider,
  chunkCodeAst,
  defaultEmbeddingConfig,
  detectLanguage,
  indexContentTool,
  indexStatusTool,
  loadDocuments,
  queryIndexTool,
  // No longer need getRagCollection directly
} from '@sylphlab/mcp-rag-core';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

// --- Configuration Loading (Example) ---
const vectorDbConfig = VectorDbConfigSchema.parse({
  provider: VectorDbProvider.ChromaDB,
  path: path.join(workspaceRoot, '.mcp', 'chroma_db'),
  collectionName: 'mcp_rag_default_collection',
});

const embeddingConfig = {
  ...defaultEmbeddingConfig,
};

// --- Server Setup ---
const server = new McpServer({
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
});

// --- Tool Registration ---
const toolsToRegister = [indexContentTool, queryIndexTool, indexStatusTool];

registerTools(server, toolsToRegister);

// --- Startup Indexing ---
async function startIndexing() {
  try {
    // 1. Initialize Embedding Function
    let embeddingFn: IEmbeddingFunction;
    if (embeddingConfig.provider === EmbeddingModelProvider.Ollama) {
      // Assert a more specific type within this block
      const ollamaConfig = embeddingConfig as { modelName?: string; baseURL?: string };
      const ollamaModel = ollamaConfig.modelName || 'nomic-embed-text';
      const ollamaUrl = ollamaConfig.baseURL;
      embeddingFn = new OllamaEmbeddingFunction(ollamaModel, ollamaUrl);
    } else if (embeddingConfig.provider === EmbeddingModelProvider.Mock) {
      // Type guard to ensure mockDimension exists
      embeddingFn = new MockEmbeddingFunction(embeddingConfig.mockDimension);
    } else {
      embeddingFn = new MockEmbeddingFunction(); // Use default dimension
    }

    // 2. Initialize IndexManager (Pass embedding function)
    const indexManager = await IndexManager.create(vectorDbConfig, embeddingFn); // Use corrected signature
    const documents = await loadDocuments(workspaceRoot);
    if (documents.length === 0) {
      return;
    }
    const allChunks: Chunk[] = [];
    for (const doc of documents) {
      const language = detectLanguage((doc.metadata?.filePath as string | undefined) || doc.id);
      const chunks = await chunkCodeAst(doc.content, language, undefined, doc.metadata);
      allChunks.push(...chunks);
    }
    if (allChunks.length === 0) {
      return;
    }
    const vectors = await embeddingFn.generate(allChunks.map((c) => c.content));
    if (vectors.length !== allChunks.length) {
      throw new Error(
        `Mismatch between chunk count (${allChunks.length}) and vector count (${vectors.length})`,
      );
    }

    // 6. Create IndexedItems
    const indexedItems: IndexedItem[] = allChunks.map((chunk, index) => ({
      ...chunk,
      id: `${chunk.metadata?.filePath || chunk.id}::${chunk.metadata?.chunkIndex ?? index}`,
      vector: vectors[index],
    }));
    await indexManager.upsertItems(indexedItems);
    const currentIds = new Set(indexedItems.map((item) => item.id));
    const existingIds = await indexManager.getAllIds();
    const staleIds = existingIds.filter((id) => !currentIds.has(id));

    if (staleIds.length > 0) {
      await indexManager.deleteItems(staleIds);
    } else {
    }
  } catch (_error) {}
}

// --- Start Server ---
async function startServer() {
  try {
    await startIndexing();
  } catch (_error) {
    process.exit(1);
  }
}

startServer();
