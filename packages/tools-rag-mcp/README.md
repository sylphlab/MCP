# @sylphlab/tools-rag-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-rag-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-rag-mcp) [![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?style=flat-square&logo=github)](https://github.com/sylphlab/mcp-plugins/tree/main/packages/rag-mcp)

**Build and query Retrieval-Augmented Generation (RAG) indexes remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes RAG functionalities (indexing content, querying indexes, checking status) based on the tools defined in `@sylphlab/tools-rag`.

## Purpose

This server allows MCP clients (like AI agents, research tools, or knowledge management systems) to remotely manage and query vector indexes for RAG workflows. It acts as a secure interface, taking the core RAG logic from `@sylphlab/tools-rag`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio). This enables clients to leverage powerful RAG capabilities without needing direct access to vector databases, embedding models, or complex parsing logic.

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes RAG Tools:** Provides tools for:
    *   Indexing content (`indexContentTool`): Load, parse, chunk, embed, and store documents in a vector index.
    *   Querying indexes (`queryIndexTool`): Retrieve relevant document chunks based on a query.
    *   Checking index status (`indexStatusTool`): Get metadata about an index.
*   **Configuration:** Likely uses environment variables (via `dotenv`) for configuring vector database connections (ChromaDB, Pinecone), embedding model endpoints/API keys, etc.
*   **Executable:** Provides a binary (`mcp-rag-server`) for easy execution.
*   **Secure:** Operates within the defined working directory and relies on configured credentials for external services.

## Installation & Configuration

This package is intended to be used as a standalone server and requires configuration via environment variables.

**1. Configuration:**

Create a `.env` file in the directory where you will run the server (or configure environment variables through your deployment method). Essential variables might include:

```dotenv
# Example .env configuration

# Choose Vector DB: 'chromadb' or 'pinecone'
VECTOR_DB_PROVIDER=chromadb
# ChromaDB specific (if used)
CHROMA_DB_URL=http://localhost:8000

# Pinecone specific (if used)
# PINECONE_API_KEY=your_pinecone_api_key
# PINECONE_ENVIRONMENT=your_pinecone_environment

# Embedding Model Configuration
# Example using Ollama (via ollama-ai-provider in core)
EMBEDDING_PROVIDER=ollama
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_BASE_URL=http://localhost:11434 # Optional, defaults locally

# Example using OpenAI (via 'ai' package in core)
# EMBEDDING_PROVIDER=openai
# OPENAI_API_KEY=your_openai_api_key
# OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```
*(Consult the `@sylphlab/tools-rag` documentation for specific required environment variables based on your chosen vector database and embedding provider.)*

**2. Installation:**

**Using npm/pnpm/yarn (Recommended)**

Install globally or in a project:

```bash
# Globally
npm install -g @sylphlab/tools-rag-mcp
# Or in a project
pnpm add @sylphlab/tools-rag-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to run the server, ensuring it can access the `.env` file (usually by setting the `cwd`):

```json
// Using npx
{
  "mcpServers": {
    "rag-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-rag-mcp"],
      "name": "RAG Tools (npx)",
      "cwd": "/path/containing/.env/and/data" // Set CWD
    }
  }
}

// Or using global install path
{
  "mcpServers": {
    "rag-mcp": {
      "command": "mcp-rag-server", // If in PATH
      "name": "RAG Tools (Global)",
      "cwd": "/path/containing/.env/and/data" // Set CWD
    }
  }
}
```

**Using Docker (If Available)**

*(Requires a Docker image `sylphlab/tools-rag-mcp:latest` to be published)*

```bash
docker pull sylphlab/tools-rag-mcp:latest
```

Configure your MCP host, mounting the project directory and potentially passing the environment file:

```json
{
  "mcpServers": {
    "rag-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", "--rm",
        "--env-file", "/path/to/your/.env", // Pass environment variables
        "-v", "/path/to/your/project:/app", // Mount project data
        "-w", "/app", // Set working directory
        "sylphlab/tools-rag-mcp:latest"
      ],
      "name": "RAG Tools (Docker)"
    }
  }
}
```

**Local Build (For Development)**

1.  **Configure:** Create `.env` file in `packages/tools-rag-mcp`.
2.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-rag-mcp`
3.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "rag-mcp": {
          "command": "node",
          "args": ["./packages/tools-rag-mcp/dist/index.js"],
          "name": "RAG Tools (Local Build)",
          "cwd": "./packages/tools-rag-mcp" // Directory containing .env
        }
      }
    }
    ```

## Usage

Once the server is running with proper configuration and connected via MCP, clients can index content and perform queries.

**MCP Request Example (Index Content):**

```json
{
  "tool_name": "indexContentTool",
  "arguments": {
    "indexName": "project-docs-index",
    "contentPaths": ["./docs/**/*.md"], // Index markdown files
    // Config args might be optional if read fully from .env
    // "vectorDbConfig": { "provider": "chromadb", "url": "http://localhost:8000" },
    // "embeddingModelConfig": { "provider": "ollama", "model": "nomic-embed-text" }
  }
}
```

**MCP Request Example (Query Index):**

```json
{
  "tool_name": "queryIndexTool",
  "arguments": {
    "indexName": "project-docs-index",
    "query": "How do I configure the RAG server?",
    "topK": 3
    // Config args might be optional
  }
}
```

**Expected Response Snippet (Query):**

```json
{
  "result": {
    "success": true,
    "results": [
      { "id": "...", "score": 0.85, "text": "..." },
      { "id": "...", "score": 0.82, "text": "..." },
      { "id": "...", "score": 0.79, "text": "..." }
    ]
  }
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions.
*   `@sylphlab/tools-rag`: Contains the core RAG logic (parsing, chunking, embedding, vector store interaction).
*   `@sylphlab/tools-core`: Provides the base tool definition structure.
*   `dotenv`: For loading environment variables from a `.env` file.

---

Developed by Sylph Lab.