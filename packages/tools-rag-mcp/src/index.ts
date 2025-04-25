// packages/tools-rag-mcp/src/index.ts

import { createRequire } from 'node:module';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto'; // Import crypto for hashing
import { z } from 'zod';
import yargs from 'yargs'; // Import yargs
import { hideBin } from 'yargs/helpers'; // Helper for parsing argv

import { startMcpServer } from '@sylphlab/tools-adaptor-mcp';
import type { Tool, ToolExecuteOptions } from '@sylphlab/tools-core';
import {
  // Core tools are still needed
  indexContentTool,
  queryIndexTool,
  indexStatusTool,
  // Config schemas and enums for parsing args
  VectorDbConfigSchema,
  EmbeddingModelConfigSchema,
  VectorDbProvider,
  EmbeddingModelProvider,
  defaultEmbeddingConfig,
  // Type for tool options
  type RagCoreToolExecuteOptions,
  type RagConfig, // Needed for tool options
} from '@sylphlab/tools-rag';
import {
  RagIndexService,
  type RagServiceConfig, // Import the full service config type
} from '@sylphlab/tools-rag-service';

// dotenv.config(); // Removed

const require = createRequire(import.meta.url);
const { name, version, description } = require('../package.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming the script runs from dist, adjust path to get workspace root
const workspaceRoot = path.resolve(__dirname, '../../../'); // Adjust if build output changes structure

// --- Configuration Loading ---

// Define a schema for the service-specific parts of the config
const ServiceOnlyConfigSchema = z.object({
    autoWatchEnabled: z.boolean().default(true),
    respectGitignore: z.boolean().default(true),
    debounceDelay: z.number().int().positive().default(2000),
    includePatterns: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
});

// Combine core RAG config and service config schemas
const RagServiceConfigSchema = z.intersection(
    z.object({
        vectorDb: VectorDbConfigSchema,
        embedding: EmbeddingModelConfigSchema,
    }),
    ServiceOnlyConfigSchema
);


async function loadRagServiceConfig(): Promise<RagServiceConfig> {
    // --- Defaults ---
    // Generate default collection name based on hashed workspace root path for uniqueness per project
    const workspaceHash = crypto.createHash('sha1').update(workspaceRoot).digest('hex').substring(0, 12);
    const defaultCollectionName = `rag_${workspaceHash}`;
    // const defaultDbPath = path.join(workspaceRoot, '.rag_db'); // Removed

    // --- Parse Command Line Arguments ---
    const argv = await yargs(hideBin(process.argv))
        .option('db-provider', {
            choices: Object.values(VectorDbProvider),
            default: VectorDbProvider.ChromaDB,
            description: 'Vector DB provider',
        })
        // .option('db-path', { // Removed - ChromaJS client primarily uses HTTP
        //     type: 'string',
        //     default: defaultDbPath,
        //     description: 'Path for local ChromaDB (Likely non-functional with JS client)',
        // })
        .option('db-host', {
            type: 'string',
            description: 'Host URL for remote ChromaDB',
        })
        .option('collection-name', {
            type: 'string',
            default: defaultCollectionName,
            description: 'Name of the collection/index',
        })
        .option('pinecone-api-key', {
            type: 'string',
            description: 'Pinecone API Key (required if db-provider=pinecone)',
        })
        .option('pinecone-index-name', {
            type: 'string',
            description: 'Pinecone Index Name (required if db-provider=pinecone)',
        })
        .option('pinecone-namespace', {
            type: 'string',
            description: 'Pinecone Namespace (optional)',
        })
        .option('embedding-provider', {
            choices: Object.values(EmbeddingModelProvider),
            default: EmbeddingModelProvider.Ollama,
            description: 'Embedding model provider',
        })
        .option('ollama-model', {
            type: 'string',
            default: 'nomic-embed-text',
            description: 'Ollama model name',
        })
        .option('ollama-base-url', {
            type: 'string',
            description: 'Ollama base URL (optional)',
        })
        .option('http-embedding-url', {
            type: 'string',
            description: 'URL for HTTP embedding endpoint (required if embedding-provider=http)',
        })
        .option('http-embedding-headers', {
            type: 'string', // Expect JSON string
            description: 'JSON string of headers for HTTP embedding endpoint (optional)',
        })
        .option('auto-watch', {
            type: 'boolean',
            default: true,
            description: 'Enable automatic file watching and re-indexing',
        })
        .option('respect-gitignore', {
            type: 'boolean',
            default: true,
            description: 'Respect .gitignore rules',
        })
        .option('debounce-delay', {
            type: 'number',
            default: 2000,
            description: 'Debounce delay (ms) for file watching events',
        })
        // TODO: Add include/exclude patterns parsing if needed
        .help()
        .alias('h', 'help')
        .parseAsync();

    // --- Construct Config Objects ---
    let vectorDbConfig: any = { provider: argv.dbProvider };
    if (argv.dbProvider === VectorDbProvider.ChromaDB) {
        // Always require host for ChromaDB with JS client
        const dbHost = argv.dbHost || 'http://localhost:8000'; // Default to localhost if not provided
        console.warn(`ChromaDB provider selected. Ensure a ChromaDB server is running and accessible at ${dbHost}`);
        vectorDbConfig = {
            provider: VectorDbProvider.ChromaDB,
            host: dbHost, // Use host (URL)
            path: undefined, // Explicitly set path to undefined
            collectionName: argv.collectionName,
        };
    } else if (argv.dbProvider === VectorDbProvider.Pinecone) {
        vectorDbConfig = {
            provider: VectorDbProvider.Pinecone,
            apiKey: argv.pineconeApiKey || '',
            indexName: argv.pineconeIndexName || '',
            namespace: argv.pineconeNamespace,
        };
    } else {
        vectorDbConfig = { provider: VectorDbProvider.InMemory };
    }

    let embeddingConfig: any = { provider: argv.embeddingProvider };
    if (argv.embeddingProvider === EmbeddingModelProvider.Ollama) {
        embeddingConfig = {
            provider: EmbeddingModelProvider.Ollama,
            modelName: argv.ollamaModel,
            baseURL: argv.ollamaBaseUrl,
        };
    } else if (argv.embeddingProvider === EmbeddingModelProvider.Http) {
        let headers;
        try {
            headers = argv.httpEmbeddingHeaders ? JSON.parse(argv.httpEmbeddingHeaders) : undefined;
        } catch (e) {
            console.warn("Failed to parse HTTP embedding headers JSON:", e);
            headers = undefined;
        }
        embeddingConfig = {
            provider: EmbeddingModelProvider.Http,
            url: argv.httpEmbeddingUrl || '',
            headers: headers,
        };
    } else { // Mock provider needs defaults from schema for validation
        embeddingConfig = {
             provider: EmbeddingModelProvider.Mock,
             // Let zod add defaults for mockDimension, batchSize
        };
    }

    const serviceConfig = {
        autoWatchEnabled: argv.autoWatch,
        respectGitignore: argv.respectGitignore,
        debounceDelay: argv.debounceDelay,
        // includePatterns: argv.includePatterns, // Add if parsed
        // excludePatterns: argv.excludePatterns, // Add if parsed
    };

    // --- Combine and Validate ---
    const fullConfigInput = {
        vectorDb: vectorDbConfig,
        embedding: embeddingConfig,
        ...serviceConfig,
    };

    try {
        // Use parse to validate and apply defaults from schemas
        const validatedConfig = RagServiceConfigSchema.parse(fullConfigInput);
        console.log("Loaded RAG Service Config from args:", validatedConfig);
        return validatedConfig;
    } catch (error) {
        console.error("Failed to validate RAG configuration from args:", error);
        console.warn("Using default configuration due to validation errors.");
        // Construct a minimal safe default config using parse
        return RagServiceConfigSchema.parse({
             vectorDb: { provider: VectorDbProvider.InMemory },
             embedding: { provider: EmbeddingModelProvider.Mock }, // Zod will add defaults
             autoWatchEnabled: false, // Safer default
             respectGitignore: true,
             debounceDelay: 2000,
        });
    }
}


// --- Server Setup ---

// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
const tools: Tool<any>[] = [indexContentTool, queryIndexTool, indexStatusTool];

// --- Start Server ---

// Declare ragService in a higher scope to be accessible by shutdown handlers
let ragService: RagIndexService | null = null;

async function startServer() {
  // let ragService: RagIndexService | null = null; // Removed from here
  let serviceConfig: RagServiceConfig | null = null;

  try {
    // 1. Load Configuration from Command Line Args
    serviceConfig = await loadRagServiceConfig(); // Now async

    // 2. Initialize RAG Service
    ragService = new RagIndexService(serviceConfig, workspaceRoot);
    await ragService.initialize();

    // 3. Perform Initial Sync
    console.log("Performing initial workspace index sync...");
    await ragService.syncWorkspaceIndex();
    console.log("Initial sync completed.");

    // 4. Start File Watcher (if enabled)
    ragService.startWatching(); // Service internally checks autoWatchEnabled

  } catch (setupError) {
    console.error('Failed during RAG service setup:', setupError);
    // Decide if server should still start without RAG service, or exit
    // For now, let's allow server to start but log the error prominently
    // process.exit(1); // Optionally exit
  }

  // 5. Prepare Tool Options for MCP Server
  // Ensure ragConfig is passed, even if service setup failed (use loaded or default config)
  const ragConfigForTools: RagConfig = serviceConfig ? {
      vectorDb: serviceConfig.vectorDb,
      embedding: serviceConfig.embedding,
  } : { // Fallback if serviceConfig loading failed entirely
      vectorDb: { provider: VectorDbProvider.InMemory },
      // Provide full default mock embedding config for type compatibility
      embedding: {
          provider: EmbeddingModelProvider.Mock,
          mockDimension: 768, // Add default dimension
          batchSize: 32, // Add default batch size
      },
  };

  const toolOptions: RagCoreToolExecuteOptions = {
    workspaceRoot: workspaceRoot, // Use calculated workspace root
    ragConfig: ragConfigForTools,
    // Add other base options if needed
  };

  // 6. Start the MCP server
  console.log("Starting MCP server...");
  await startMcpServer(
    {
      name,
      version,
      description,
      tools,
    },
    toolOptions, // Pass the extended options object
  );
  console.log("MCP server started successfully.");
}

// Use an async IIFE to call the startServer function
(async () => {
  await startServer();
  // If startServer completes without exiting, the server is running.
})();

// Optional: Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down...');
  // Stop watcher if service was initialized
  await ragService?.stopWatching();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down...');
  // Stop watcher if service was initialized
  await ragService?.stopWatching();
  process.exit(0);
});
