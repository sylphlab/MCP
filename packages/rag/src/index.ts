import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '@sylphlab/mcp-utils';
// Import version from package.json
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
// Import specific functions and types directly from rag-core
import {
    indexContentTool,
    queryIndexTool,
    indexStatusTool,
    IndexManager,
    VectorDbConfigSchema,
    VectorDbProvider,
    EmbeddingModelProvider,
    defaultEmbeddingConfig,
    loadDocuments,
    chunkCodeAst,
    detectLanguage,
    OllamaEmbeddingFunction,
    MockEmbeddingFunction,
    IEmbeddingFunction,
    Chunk,
    IndexedItem,
    // No longer need getRagCollection directly
} from '@sylphlab/mcp-rag-core';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

console.log('MCP RAG Server starting...');
console.log(`Workspace Root: ${workspaceRoot}`);

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
const toolsToRegister = [
    indexContentTool,
    queryIndexTool,
    indexStatusTool,
];

registerTools(server, toolsToRegister);

// --- Startup Indexing ---
async function startIndexing() {
    console.log('Starting initial project indexing...');
    try {
        // 1. Initialize Embedding Function
        let embeddingFn: IEmbeddingFunction;
        if (embeddingConfig.provider === EmbeddingModelProvider.Ollama) {
            const ollamaModel = (embeddingConfig as any).modelName || 'nomic-embed-text';
            const ollamaUrl = (embeddingConfig as any).baseURL;
            embeddingFn = new OllamaEmbeddingFunction(ollamaModel, ollamaUrl);
        } else if (embeddingConfig.provider === EmbeddingModelProvider.Mock) {
            // Type guard to ensure mockDimension exists
            embeddingFn = new MockEmbeddingFunction(embeddingConfig.mockDimension);
        } else {
            // Fallback or throw error if provider is unexpected
            console.warn(`Unsupported embedding provider in config: ${embeddingConfig.provider}. Falling back to MockEmbeddingFunction.`);
            embeddingFn = new MockEmbeddingFunction(); // Use default dimension
        }

        // 2. Initialize IndexManager (Pass embedding function)
        const indexManager = await IndexManager.create(vectorDbConfig, embeddingFn); // Use corrected signature

        // 3. Load documents
        console.log(`Loading documents from: ${workspaceRoot}`);
        const documents = await loadDocuments(workspaceRoot);
        console.log(`Loaded ${documents.length} documents.`);
        if (documents.length === 0) {
            console.log("No documents found to index.");
            return;
        }

        // 4. Chunk documents
        console.log('Chunking documents...');
        const allChunks: Chunk[] = [];
        for (const doc of documents) {
           const language = detectLanguage(doc.metadata?.filePath || doc.id);
           const chunks = await chunkCodeAst(doc.content, language, undefined, doc.metadata);
           allChunks.push(...chunks);
        }
         console.log(`Generated ${allChunks.length} chunks.`);
         if (allChunks.length === 0) {
            console.log("No chunks generated from documents.");
            return;
        }

        // 5. Generate embeddings using the embedding function instance
        console.log('Generating embeddings...');
        const vectors = await embeddingFn.generate(allChunks.map(c => c.content));
        console.log(`Generated ${vectors.length} vectors.`);
         if (vectors.length !== allChunks.length) {
            throw new Error(`Mismatch between chunk count (${allChunks.length}) and vector count (${vectors.length})`);
        }

        // 6. Create IndexedItems
        const indexedItems: IndexedItem[] = allChunks.map((chunk, index) => ({
            ...chunk,
            id: `${chunk.metadata?.filePath || chunk.id}::${chunk.metadata?.chunkIndex ?? index}`,
            vector: vectors[index],
        }));

        // 7. Upsert items
        console.log(`Upserting ${indexedItems.length} items to index...`);
        await indexManager.upsertItems(indexedItems);

        // 8. Remove stale items
        console.log('Checking for stale items in the index...');
        const currentIds = new Set(indexedItems.map(item => item.id));
        const existingIds = await indexManager.getAllIds();
        const staleIds = existingIds.filter(id => !currentIds.has(id));

        if (staleIds.length > 0) {
            console.log(`Found ${staleIds.length} stale items to remove.`);
            await indexManager.deleteItems(staleIds);
            console.log(`Removed ${staleIds.length} stale items.`);
        } else {
            console.log('No stale items found.');
        }

        console.log('Initial project indexing completed.');
    } catch (error) {
        console.error('Error during initial indexing:', error);
    }
}

// --- Start Server ---
async function startServer() {
    try {
        await startIndexing();
        console.log(`MCP RAG Server initialized and ready on stdio.`);
    } catch (error) {
        console.error('Failed to start MCP RAG Server:', error);
        process.exit(1);
    }
}

startServer();
