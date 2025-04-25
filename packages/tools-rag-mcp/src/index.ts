// packages/tools-rag-mcp/src/index.ts

import { createRequire } from 'node:module';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { z } from 'zod';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { startMcpServer } from '@sylphlab/tools-adaptor-mcp';
import type { Tool, ToolExecuteOptions } from '@sylphlab/tools-core';
import {
  // Core tools
  indexContentTool,
  queryIndexTool,
  indexStatusTool,
  // Config schemas and enums
  VectorDbConfigSchema,
  EmbeddingModelConfigSchema,
  VectorDbProvider,
  EmbeddingModelProvider,
  defaultEmbeddingConfig,
  // Types
  type RagToolExecuteOptions, // Correct extended options type
  type RagConfig,
  type IndexManager, // Import IndexManager type
} from '@sylphlab/tools-rag';
import {
  RagIndexService,
  type RagServiceConfig,
} from '@sylphlab/tools-rag-service';

const require = createRequire(import.meta.url);
const { name, version, description } = require('../package.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../../');

// --- Configuration Loading ---

const ServiceOnlyConfigSchema = z.object({
    autoWatchEnabled: z.boolean().default(true),
    respectGitignore: z.boolean().default(true),
    debounceDelay: z.number().int().positive().default(2000),
    includePatterns: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
    chunkingOptions: z.object({
        maxChunkSize: z.number().int().positive().optional(),
        chunkOverlap: z.number().int().nonnegative().optional(),
    }).optional(),
});

const RagServiceConfigSchema = z.intersection(
    z.object({
        vectorDb: VectorDbConfigSchema,
        embedding: EmbeddingModelConfigSchema,
    }),
    ServiceOnlyConfigSchema
);


async function loadRagServiceConfig(): Promise<RagServiceConfig> {
    const workspaceHash = crypto.createHash('sha1').update(workspaceRoot).digest('hex').substring(0, 12);
    const defaultCollectionName = `rag_${workspaceHash}`;

    const argv = await yargs(hideBin(process.argv))
        .option('db-provider', { choices: Object.values(VectorDbProvider), default: VectorDbProvider.ChromaDB, description: 'Vector DB provider' })
        .option('db-host', { type: 'string', description: 'Host URL for ChromaDB (e.g., http://localhost:8000)' })
        .option('collection-name', { type: 'string', default: defaultCollectionName, description: 'Name of the collection/index' })
        .option('pinecone-api-key', { type: 'string', description: 'Pinecone API Key' })
        .option('pinecone-index-name', { type: 'string', description: 'Pinecone Index Name' })
        .option('pinecone-namespace', { type: 'string', description: 'Pinecone Namespace' })
        .option('embedding-provider', { choices: Object.values(EmbeddingModelProvider), default: EmbeddingModelProvider.Ollama, description: 'Embedding model provider' })
        .option('ollama-model', { type: 'string', default: 'nomic-embed-text', description: 'Ollama model name' })
        .option('ollama-base-url', { type: 'string', description: 'Ollama base URL' })
        .option('http-embedding-url', { type: 'string', description: 'URL for HTTP embedding endpoint' })
        .option('http-embedding-headers', { type: 'string', description: 'JSON string of headers for HTTP embedding endpoint' })
        .option('auto-watch', { type: 'boolean', default: true, description: 'Enable automatic file watching' })
        .option('respect-gitignore', { type: 'boolean', default: true, description: 'Respect .gitignore rules' })
        .option('debounce-delay', { type: 'number', default: 2000, description: 'Debounce delay (ms)' })
        .option('max-chunk-size', { type: 'number', description: 'Maximum size of code chunks' })
        .option('chunk-overlap', { type: 'number', description: 'Chunk overlap' })
        .help().alias('h', 'help')
        .parseAsync();

    // Construct Config Objects
    let vectorDbConfig: any = { provider: argv.dbProvider };
    if (argv.dbProvider === VectorDbProvider.ChromaDB) {
        const dbHost = argv.dbHost || 'http://localhost:8000';
        vectorDbConfig = { provider: VectorDbProvider.ChromaDB, host: dbHost, path: undefined, collectionName: argv.collectionName };
    } else if (argv.dbProvider === VectorDbProvider.Pinecone) {
        vectorDbConfig = { provider: VectorDbProvider.Pinecone, apiKey: argv.pineconeApiKey || '', indexName: argv.pineconeIndexName || '', namespace: argv.pineconeNamespace };
    } else {
        vectorDbConfig = { provider: VectorDbProvider.InMemory };
    }

    let embeddingConfig: any = { provider: argv.embeddingProvider };
    if (argv.embeddingProvider === EmbeddingModelProvider.Ollama) {
        embeddingConfig = { provider: EmbeddingModelProvider.Ollama, modelName: argv.ollamaModel, baseURL: argv.ollamaBaseUrl };
    } else if (argv.embeddingProvider === EmbeddingModelProvider.Http) {
        let headers; try { headers = argv.httpEmbeddingHeaders ? JSON.parse(argv.httpEmbeddingHeaders) : undefined; } catch (e) { console.warn("Failed to parse HTTP headers JSON:", e); headers = undefined; }
        embeddingConfig = { provider: EmbeddingModelProvider.Http, url: argv.httpEmbeddingUrl || '', headers: headers };
    } else {
        embeddingConfig = { provider: EmbeddingModelProvider.Mock };
    }

    const chunkingOptions: { maxChunkSize?: number; chunkOverlap?: number } = {};
    if (argv.maxChunkSize !== undefined && argv.maxChunkSize > 0) { chunkingOptions.maxChunkSize = argv.maxChunkSize; }
    if (argv.chunkOverlap !== undefined && argv.chunkOverlap >= 0) { chunkingOptions.chunkOverlap = argv.chunkOverlap; }

    const serviceConfig = {
        autoWatchEnabled: argv.autoWatch,
        respectGitignore: argv.respectGitignore,
        debounceDelay: argv.debounceDelay,
        ...(Object.keys(chunkingOptions).length > 0 ? { chunkingOptions } : {}),
    };

    // Combine and Validate
    const fullConfigInput = { vectorDb: vectorDbConfig, embedding: embeddingConfig, ...serviceConfig };

    try {
        const validatedConfig = RagServiceConfigSchema.parse(fullConfigInput);
        console.log("Loaded RAG Service Config from args:", validatedConfig);
        return validatedConfig;
    } catch (error) {
        console.error("Failed to validate RAG configuration from args:", error);
        console.warn("Using default configuration due to validation errors.");
        return RagServiceConfigSchema.parse({
             vectorDb: { provider: VectorDbProvider.InMemory },
             embedding: { provider: EmbeddingModelProvider.Mock },
             autoWatchEnabled: false, respectGitignore: true, debounceDelay: 2000,
        });
    }
}


// --- Server Setup ---
const tools: Tool<any>[] = [indexContentTool, queryIndexTool, indexStatusTool];

// --- Start Server ---
let ragService: RagIndexService | null = null; // Keep in higher scope for shutdown

async function startServer() {
  let serviceConfig: RagServiceConfig | null = null;
  let indexManagerInstance: IndexManager | null = null;

  try {
    // 1. Load Config
    serviceConfig = await loadRagServiceConfig();

    // 2. Initialize RAG Service
    console.log("Initializing RAG Service...");
    ragService = new RagIndexService(serviceConfig, workspaceRoot);
    await ragService.initialize();
    indexManagerInstance = ragService.indexManagerInstance; // Get instance via getter
    console.log("RAG Service initialized.");

    if (!indexManagerInstance) {
        throw new Error("IndexManager instance is null after RAG service initialization.");
    }

  } catch (setupError) {
    console.error('Failed during RAG service config loading or initialization:', setupError);
    console.error("Exiting due to RAG service initialization failure.");
    process.exit(1);
  }

  // 3. Prepare Tool Options *with* the IndexManager instance
  const ragConfigForTools: RagConfig = {
      vectorDb: serviceConfig.vectorDb,
      embedding: serviceConfig.embedding,
  };
  // Use the correct extended type RagToolExecuteOptions
  const toolOptions: RagToolExecuteOptions = {
      workspaceRoot: workspaceRoot,
      ragConfig: ragConfigForTools,
      indexManager: indexManagerInstance, // Pass the non-null instance
  };


  // 4. Start the MCP server
  console.log("Starting MCP server...");
  startMcpServer(
    { name, version, description, tools },
    toolOptions // Pass the extended options
  ).then(() => {
      console.log("MCP server started successfully and listening.");

      // 5. Start watching (which includes initial scan) *after* MCP server starts
      if (ragService) {
          console.log("Starting background RAG initial scan and watching...");
          // Fire-and-forget async function
          (async () => {
              try {
                  await ragService.startWatching(); // This now handles initial scan + watching
              } catch (bgError) {
                  console.error("Error during background RAG scan/watch:", bgError);
              }
          })();
      } else {
          // This case should not happen due to exit(1) in catch block above
          console.error("RAG service not available, cannot start watching.");
      }

  }).catch(mcpError => {
      console.error("Failed to start MCP server:", mcpError);
      process.exit(1);
  });

  // Process should stay alive due to startMcpServer listener
}


// Use an async IIFE to call the startServer function
(async () => {
  await startServer();
})();

// Optional: Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down...');
  await ragService?.stopWatching();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down...');
  await ragService?.stopWatching();
  process.exit(0);
});
