# RAG Tools & Service Development Summary (2025-04-25)

This document summarizes the development process, design decisions, current status, and future plans for the RAG (Retrieval-Augmented Generation) tools and associated services.

## Initial Goal

Implement core RAG tools (`indexContent`, `queryIndex`, `indexStatus`) and expose them via an MCP server (`tools-rag-mcp`), enabling semantic search over the project workspace.

## Architecture & Design Evolution

The architecture underwent several iterations based on feedback and technical challenges:

1.  **Initial Check:** Verified the existence and basic structure of core RAG tools in `@sylphlab/tools-rag`.
2.  **Feedback 1 (Auto-Update & Config):** User requested automatic index updates based on file changes, configuration management (Ollama, behavior), and `.gitignore` support.
3.  **Attempt 1 (Settings Tool):** Proposed a `ragSettingsTool` to manage configuration stored in a JSON file. **Rejected** because AI tools shouldn't typically modify system settings.
4.  **Attempt 2 (Config via Options):** Discussed passing all config directly via `ToolExecuteOptions`. **Rejected** due to potential complexity, state inconsistency, and unsuitability for background services (file watching).
5.  **Attempt 3 (Separate Service + JSON Config):** Proposed a new `tools-rag-service` package containing `RagIndexService` (handling sync, watch, config loading from JSON). **Refined** based on feedback about config source and DB path handling.
6.  **Attempt 4 (Separate Service + Env Vars/Args + Config in Options):** Config source changed to env vars/args (developer-controlled). Config object (`RagServiceConfig`) passed via extended `ToolExecuteOptions`. **Refined** due to complexity and questions about tool vs. service responsibility.
7.  **Attempt 5 (Separate Service + Env Vars/Args + Service Instance in Options):** Proposed passing the initialized `RagIndexService` instance via extended `ToolExecuteOptions`. **Refined** based on user feedback questioning the need for tools to depend on the service instance directly.
8.  **Attempt 6 (Final Architecture):**
    *   **Core Tools (`tools-rag`):** Remain independent. Receive necessary `RagConfig` (DB/embedding settings) and the initialized `IndexManager` instance via extended `RagToolExecuteOptions`.
    *   **Service (`tools-rag-service`):** Optional package providing `RagIndexService` class for background sync and watching. Reads its own config (including `RagConfig`) during initialization. Exposes the `IndexManager` instance via a getter (`indexManagerInstance`).
    *   **Adapter (`tools-rag-mcp`):** Reads config from command-line arguments (`yargs`). Initializes `RagIndexService`. Starts MCP server *first*, passing `toolOptions` (containing `ragConfig` and the `indexManager` instance) to `startMcpServer`. Triggers background sync/watch *after* MCP server starts.

## Deployment Strategy Evolution

1.  **Initial:** Local execution via `pnpm start`.
2.  **ChromaDB Issue:** Encountered connection errors with `ChromaClient`'s local file path mode (`--db-path`), likely due to library behavior or environment issues. Confirmed JS client primarily expects a running server.
3.  **Docker Compose:** Introduced `docker-compose.yml` (within `tools-rag-mcp`) to run ChromaDB and Ollama as separate services, connecting the MCP server via `--db-host`. This resolved connection issues and provides a convenient local dev setup.
4.  **Self-Contained Image Discussion:** Explored creating a single image with `supervisord` but decided against it due to complexity and reduced flexibility, favoring the Docker Compose approach for local dev and a simple Node server image for `docker run` (requiring external dependencies).
5.  **Final Deployment Strategy:**
    *   Simple `Dockerfile` for the Node.js MCP server only.
    *   `docker-compose.yml` within the package for easy local stack setup (Node, ChromaDB, Ollama).
    *   README documentation (to be added) explaining both `docker run` (with external dependencies) and `docker-compose up` options.

## Debugging & Fixes

*   Resolved numerous build errors related to JSON comments, missing dependencies (`lodash-es`, `zod`, types), incorrect exports (`HttpEmbeddingFunction`, `RagToolExecuteOptions`), stale type caches, and incorrect type usage (`ToolExecuteOptions` vs. extended versions, `IndexManager` methods).
*   Addressed `ChromaClient` connection errors by switching from `--db-path` to `--db-host` and using an external ChromaDB server. Corrected `ChromaClient` initialization logic in `IndexManager`.
*   Corrected logic for passing the shared `IndexManager` instance to tools via `RagToolExecuteOptions`.
*   Refactored MCP server startup to run indexing in the background, preventing client timeouts.
*   Added command-line arguments for chunking options (`--max-chunk-size`, `--chunk-overlap`).

## Current Status (2025-04-25)

*   Core tools (`@sylphlab/tools-rag`) refactored and build successfully.
*   Service package (`@sylphlab/tools-rag-service`) created with `RagIndexService` structure (sync, watch, ignore handling). Builds successfully.
*   MCP adapter (`@sylphlab/tools-rag-mcp`) refactored (uses service, args config, passes `IndexManager`). Builds successfully.
*   Server runs successfully using `docker-compose up` or `pnpm start --db-host=...`.
*   `getIndexStatus` and `queryIndex` tools confirmed working via MCP connection.
*   Background file watching and re-indexing confirmed working via logs.

## Known Issues / Limitations

*   **Query Quality:** Semantic search quality for specific code queries is currently low with the default `nomic-embed-text` model.
*   **Pinecone `deleteWhere`:** The implementation in `IndexManager` currently only attempts deletion and logs a warning due to client library limitations.
*   **`loadDocuments` Filtering:** Filtering based on include/exclude/gitignore patterns currently happens *after* loading all documents in `syncWorkspaceIndex`.

## Future Plans / Next Tasks (Prioritized Order)

1.  **Refactor `indexStatusTool`:** Remove the `getRagCollection` workaround and use `IndexManager.getStatus()` correctly. *(This resolves the remaining architectural inconsistency)*.
2.  **Refine `loadDocuments` Filtering:** Modify `loadDocuments` in `@sylphlab/tools-rag` to accept and apply include/exclude/gitignore patterns during the file traversal phase for better performance.
3.  **Improve Query Quality:**
    *   Experiment with different embedding models via command-line arguments.
    *   Investigate and potentially refine the `chunkCodeAst` strategy (e.g., handling oversized AST nodes better).
4.  **Implement Pinecone `deleteWhere`:** Research and implement a robust solution for deleting Pinecone vectors based on metadata filters (if feasible with the client library).
5.  **Improve Error Handling:** Add more specific error handling and potentially retry mechanisms within `RagIndexService`.
6.  **Improve Config Validation:** Add more robust validation for complex command-line arguments (e.g., JSON strings for headers) in the adapter.
7.  **Add Status Reporting:** Add methods to `RagIndexService` for the adapter to query its current status (idle, syncing, watching, error state).
8.  **Update READMEs:** Document prerequisites, configuration options, and running methods for `@sylphlab/tools-rag-mcp`.