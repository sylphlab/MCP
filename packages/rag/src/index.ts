// Import version from package.json
import { createRequire } from 'node:module';
import process from 'node:process';
// Remove direct SDK imports
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'; // Stdio handled by factory
import { startMcpServer } from '@sylphlab/tool-adaptor-mcp'; // Import start function
const require = createRequire(import.meta.url);
const { name, version, description } = require('../package.json'); // Import metadata directly
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Tool, ToolExecuteOptions } from '@sylphlab/mcp-core'; // Import McpTool type
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

// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
const tools: Tool<any>[] = [indexContentTool, queryIndexTool, indexStatusTool];

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
// Modify startServer to also start the MCP server after indexing
async function startServer() {
  // Keep existing try/catch for startIndexing failure
  try {
    await startIndexing();
  } catch (indexError) {
    // biome-ignore lint/suspicious/noConsole: Log indexing error before exit
    console.error('Failed during startup indexing:', indexError);
    process.exit(1); // Exit if indexing fails
  }

  // Now start the MCP server (startMcpServer handles its own connection errors/exit)
  const toolOptions: ToolExecuteOptions = {
    workspaceRoot: process.cwd(),
    // Add other options if needed, e.g., allowOutsideWorkspace: false
  };
  await startMcpServer(
    {
      name, // Use name from package.json
      version, // Use version from package.json
      description, // Use description from package.json
      tools,
    },
    toolOptions, // Pass the created options object
  );
}

// Use an async IIFE to call the combined startServer function
(async () => {
  await startServer();
  // If startServer completes without exiting, the server is running.
})();
