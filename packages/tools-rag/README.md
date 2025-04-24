# @sylphlab/tools-rag

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-rag?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-rag) [![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?style=flat-square&logo=github)](https://github.com/sylphlab/mcp-plugins/tree/main/packages/rag-core)

**Core logic for building and querying Retrieval-Augmented Generation (RAG) indexes.**

This package provides the underlying logic and tool definitions for creating, managing, and querying vector indexes used in RAG workflows. It integrates document loading, parsing (including code parsing via Lezer), chunking, embedding generation (potentially via `ai` or Ollama providers), and vector storage/retrieval (using ChromaDB or Pinecone). Designed using `@sylphlab/tools-core`, it serves as the foundation for `@sylphlab/tools-rag-mcp`.

## Purpose

Retrieval-Augmented Generation enhances Large Language Models (LLMs) by providing them with relevant information retrieved from a knowledge base (vector index) before generating a response. This package provides the tools necessary to build and interact with such knowledge bases, enabling more accurate and context-aware AI applications.

## Tools Provided

*   `indexContentTool`: Loads, parses, chunks, embeds, and indexes content (text files, code files, potentially PDFs via other tools) into a specified vector index (e.g., ChromaDB, Pinecone). Supports various parsing strategies, including code-aware chunking using Lezer grammars.
*   `queryIndexTool`: Takes a user query, generates an embedding for it, and retrieves the most relevant chunks of information from a specified vector index. Returns the retrieved content for use in augmenting an LLM prompt.
*   `indexStatusTool`: Provides information about the status and contents of a specified vector index (e.g., number of documents, last updated time).

## Key Features

*   **Document Loading:** Supports loading content from various file types (using `fast-glob`).
*   **Advanced Parsing:** Includes support for parsing various file types, with specialized code parsing using Lezer grammars (JavaScript, Python, HTML, CSS, JSON, Markdown, XML) for semantic chunking.
*   **Flexible Chunking:** Offers strategies for splitting documents into manageable pieces suitable for embedding.
*   **Embedding Generation:** Integrates with embedding models (potentially via `ai` SDK or Ollama) to convert text chunks into vectors.
*   **Vector Store Integration:** Supports popular vector databases like ChromaDB and Pinecone for storing and querying embeddings.
*   **Standardized Definition:** Uses the `SylphTool` structure from `@sylphlab/tools-core`.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, serving as a dependency for `@sylphlab/tools-rag-mcp` and potentially other packages needing direct RAG logic.

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-rag --filter <your-package-name>
```

## Usage (Conceptual)

The tool definitions are typically consumed by adapters or MCP server implementations.

```typescript
import { indexContentTool, queryIndexTool, indexStatusTool } from '@sylphlab/tools-rag';
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using indexContentTool definition directly
async function runIndexContent() {
  const input = {
    indexName: 'my-codebase-index',
    contentPaths: ['./src/**/*.ts'], // Index all TypeScript files
    vectorDbConfig: { /* ChromaDB or Pinecone config */ },
    embeddingModelConfig: { /* Embedding model details */ },
    chunkingStrategy: 'code-aware', // Use Lezer parsing
  };
  // Validate input...
  const output = await indexContentTool.handler(input);
  // Validate output...
  console.log(`Indexing completed. Added ${output.addedCount} chunks.`);
}

// Example: Using queryIndexTool definition directly
async function runQueryIndex() {
  const input = {
    indexName: 'my-codebase-index',
    query: 'How is the user authentication handled?',
    vectorDbConfig: { /* ChromaDB or Pinecone config */ },
    embeddingModelConfig: { /* Embedding model details */ },
    topK: 5, // Retrieve top 5 relevant chunks
  };
  // Validate input...
  const output = await queryIndexTool.handler(input);
  // Validate output...
  if (output.success) {
    console.log('Retrieved Chunks:', output.results);
    // Use output.results to augment LLM prompt...
  }
}

// Example: Adapting for MCP
const mcpRagTools = [
  indexContentTool,
  queryIndexTool,
  indexStatusTool,
].map(adaptToolToMcp);

// These adapted definitions would then be used to create the MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides `defineTool` and core types.
*   `zod`: For input/output schema definition.
*   `@lezer/*`: Libraries for code parsing and syntax tree analysis.
*   `chromadb` / `@pinecone-database/pinecone`: Clients for interacting with vector databases.
*   `ai` / `ollama-ai-provider`: Potential integrations for accessing embedding models.
*   `fast-glob`: For finding files to index.
*   `highlight.js`: Potentially used for syntax highlighting in retrieved code snippets.
*   `node-fetch-native`: Polyfill for fetch API if needed.

---

Developed by Sylph Lab.