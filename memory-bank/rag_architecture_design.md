# RAG Tools and Service Architecture Design (2025-04-24)

This document outlines the agreed-upon architecture for the RAG (Retrieval-Augmented Generation) tools and the optional background indexing service.

## Core Principles

*   **Separation of Concerns:** Core RAG logic, optional background services, and adapter integration are clearly separated.
*   **Flexibility:** Allows using basic RAG tools independently without the background service, or combining both for automatic updates.
*   **Developer Control:** System configuration (DB, embedding model, service behavior) is controlled by the developer/operator, primarily via environment variables.
*   **AI Interface:** Tools exposed to the AI focus on task execution (`queryIndex`, `indexContent`), not system configuration.

## Package Structure and Responsibilities

1.  **`packages/tools-rag` (Core Package):**
    *   **Contains:**
        *   Core RAG logic: `IndexManager` (for DB interaction), chunking functions, embedding functions/interfaces.
        *   Basic RAG tool definitions: `indexContentTool`, `queryIndexTool`, `indexStatusTool`.
    *   **Dependencies:** None on the service package.
    *   **Tool Execution:**
        *   The `execute` function of these core tools requires configuration for DB connection and embedding model details.
        *   This configuration (`RagConfig`) is passed via an extended `ToolExecuteOptions` interface (e.g., `RagCoreToolExecuteOptions extends ToolExecuteOptions { ragConfig: RagConfig; }`).
        *   The `execute` function uses the provided `ragConfig` to perform its task (e.g., initialize `IndexManager` for the current operation).
    *   **Does NOT contain:** File watching, automatic indexing logic, or service lifecycle management.

2.  **`packages/tools-rag-service` (Optional Service Package - NEW):**
    *   **Contains:**
        *   `RagIndexService` class: Encapsulates the logic for background operations.
        *   File watching implementation (using `chokidar`).
        *   Logic for handling file events (add, change, unlink) and triggering index updates (debounced).
        *   Logic for performing initial workspace indexing (`syncWorkspaceIndex`).
        *   Logic for reading configuration needed for its operation (e.g., `autoWatchEnabled`, `debounceDelay`, `respectGitignore`, and the same `RagConfig` used by core tools).
    *   **Dependencies:** Depends on `tools-rag` for core logic (`IndexManager`, etc.) and `chokidar`.
    *   **Initialization:** Requires configuration (including `RagConfig` and service-specific settings like `autoWatchEnabled`) to be passed during instantiation.
    *   **Does NOT define:** Any tools intended for direct AI use.

3.  **`packages/tools-rag-mcp` / Other Adapters (Integration Layer):**
    *   **Responsibilities:**
        *   **Configuration Loading:** Reads RAG system configuration (DB path/URL, collection name, embedding model details, `autoWatchEnabled`, etc.) primarily from environment variables (or other developer-controlled sources like adapter-specific config files). Provides sensible defaults if variables are missing.
        *   **Service Instantiation (Optional):** Based on the loaded configuration (e.g., `autoWatchEnabled`), decides whether to instantiate `RagIndexService` from `tools-rag-service`.
        *   **Service Lifecycle (Optional):** If the service is instantiated, the adapter manages its lifecycle (e.g., calling `service.syncWorkspaceIndex()` on startup, `service.startWatching()`, `service.stopWatching()` on shutdown).
        *   **Tool Execution Handling:**
            *   Exposes the **core RAG tools** (from `tools-rag`) to the AI.
            *   When a tool is called, the adapter constructs the `RagCoreToolExecuteOptions` object, including the basic `workspaceRoot` and the loaded `ragConfig`.
            *   Calls the core tool's `execute` method with the constructed input and options.
        *   **`.gitignore` Handling:** Ensures the configured database path (if local and within the workspace) is included in `.gitignore` (potentially checking and warning the user).

## Configuration Flow

1.  **Developer/Operator:** Sets environment variables (e.g., `RAG_DB_PATH`, `RAG_COLLECTION_NAME`, `OLLAMA_URL`, `RAG_AUTO_WATCH=true`).
2.  **Adapter Startup:** Reads environment variables, determines the `RagConfig` and service settings, provides defaults.
3.  **Adapter (Optional Service):** If `autoWatchEnabled` is true, instantiates `RagIndexService` with the full configuration and starts it.
4.  **AI Tool Call:** AI requests `queryIndexTool` with `input`.
5.  **Adapter:** Creates `RagCoreToolExecuteOptions` containing `workspaceRoot` and the `ragConfig`. Calls `queryIndexTool.execute(input, options)`.
6.  **Core Tool (`queryIndexTool.execute`):** Reads `options.ragConfig`, initializes necessary components (like `IndexManager` for this specific call), performs the query, returns the result. The underlying database might be getting updated in the background by the optional `RagIndexService` if it's running.

## Key Decisions

*   No `ragSettingsTool` for AI use. Configuration is developer-controlled.
*   Core tools are independent of the background service.
*   The background service is optional and managed by the adapter.
*   Configuration (`RagConfig`) is passed to core tools via extended `ToolExecuteOptions`.