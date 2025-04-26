# RAG System Development Summary (As of 2025-04-26)

*This summary is based on a code review of the `tools-rag`, `tools-rag-mcp`, and `tools-rag-service` packages.*

## Overall Architecture

The RAG functionality is structured across three main packages:

1.  **`@sylphlab/tools-rag` (Core Library):** Contains the fundamental RAG logic:
    *   Document loading, parsing (Lezer AST), chunking (AST-based with text fallback), embedding generation (Mock, Ollama, HTTP), and index management (interaction with vector DBs).
    *   Defines core types (`Document`, `Chunk`, `RagConfig`, `IndexManager`, `IEmbeddingFunction`).
    *   Provides core functions and MCP tool definitions (`indexContentTool`, `queryIndexTool`, etc.).
    *   Acts as a non-runnable library.

2.  **`@sylphlab/tools-rag-service` (Background Service):**
    *   An optional service for automatic workspace indexing.
    *   Uses `chokidar` to monitor file changes (add, change, unlink).
    *   Manages initial scanning, processing queues, incremental updates (based on `mtime`), and stale data cleanup.
    *   Invokes the core library for chunking, embedding, and upserting.

3.  **`@sylphlab/tools-rag-mcp` (MCP Server):**
    *   A runnable Node.js application exposing RAG tools via MCP.
    *   Handles configuration loading (vector DB, embedding model, service settings) via CLI args/env vars.
    *   Optionally initializes and runs the `RagIndexService` in the background.
    *   Passes necessary instances (`IndexManager`, `RagConfig`, `RagIndexService`) to the core tools via `RagToolExecuteOptions`.

## Core Pipelines

### Indexing Pipeline

1.  **Trigger:** Manual tool call (`indexContentTool`, `manualIndexFileTool`) or background service file detection.
2.  **Load:** Read file content and metadata (service) or use provided text (tool). Respects `.gitignore` via `fast-glob`.
3.  **Parse & Chunk:**
    *   Detect language via extension.
    *   Parse code into Lezer AST.
    *   Attempt AST-based chunking using language-specific boundary nodes (e.g., functions, classes). Recurses into oversized nodes.
    *   Fallback to text-based splitting (by size/overlap) if AST chunking fails, isn't supported (Markdown currently), or yields no chunks.
4.  **Embed:**
    *   Generate vector embeddings for chunk content using the configured provider (Mock, Ollama via Vercel AI SDK, or HTTP endpoint).
5.  **Upsert:**
    *   Use `IndexManager` to write/update chunks (with vectors and metadata) into the configured vector database (In-Memory, Pinecone, ChromaDB).

### Query Pipeline

1.  **Trigger:** `queryIndexTool` call.
2.  **Embed Query:** Generate embedding for the input query text using the same configured model.
3.  **Query Index:** Use `IndexManager` to perform a similarity search in the vector database, applying optional metadata filters (`$eq` currently supported, `$ne` for `deleteWhere`).
4.  **Return Results:** Format and return the top K most similar chunks with their content, metadata, and scores.

## Background Service (`RagIndexService`) Details

*   **Initialization:** Creates Embedding Function and IndexManager, loads `.gitignore`.
*   **Watching:** Uses `chokidar` (ignoring standard patterns + configured ignores).
*   **Initial Scan:**
    *   `chokidar` identifies all existing files.
    *   Service fetches existing chunk IDs from the DB.
    *   Files are added to a processing queue.
    *   Queue is processed sequentially (`indexSingleFile`).
    *   **Incremental Check:** During the initial scan, `indexSingleFile` checks the file's `mtime` against the `mtime` stored in the DB for existing chunks. If unchanged, processing is skipped, but existing chunk IDs are tracked.
    *   **Stale Cleanup:** After the queue is empty, compares initially found DB IDs with IDs processed/kept during the scan; deletes any IDs present initially but not processed (stale data).
*   **Change Handling (Post-Scan):**
    *   `add`/`change` events trigger debounced `indexSingleFile` calls via the processing queue.
    *   `unlink` events trigger `deleteFileIndex` (using `deleteWhere`).
*   **Status:** Provides detailed status on initialization, scanning/processing phase, queue length, etc.

This provides a comprehensive overview of the current RAG system implementation based on the reviewed code.