# @sylphlab/tools-memory-mcp

MCP Server adaptor for the Knowledge Graph memory tools.

## Overview

This package provides an MCP (Model Context Protocol) server that exposes the knowledge graph memory management tools defined in `@sylphlab/tools-memory`. It acts as an adaptor, making the core logic available to AI agents via the MCP protocol over stdio.

The server reads/writes the knowledge graph data (default: `memory.json`) relative to the **current working directory (`process.cwd()`)** where the server is started.

## Features

*   **MCP Server:** Runs as a stdio-based MCP server.
*   **Adaptor:** Connects core `@sylphlab/tools-memory` tools to the MCP protocol using `@sylphlab/tools-adaptor-mcp`.
*   **CWD-based Storage:** Inherits the CWD-based storage behavior from `@sylphlab/tools-memory`.
*   **Exposed Tools:** Provides MCP access to `createEntities`, `createRelations`, `addObservations`, `deleteEntities`, `deleteObservations`, `deleteRelations`, `readGraph`, `searchNodes`, `openNodes`.

## Usage

1.  **Installation:**
    ```bash
    # Usually installed as part of the main project or globally
    pnpm add @sylphlab/tools-memory-mcp
    ```

2.  **Running the Server:**
    The package provides a binary that can be run directly:
    ```bash
    # Directly (ensure dependencies are built)
    node ./node_modules/.bin/mcp-memory

    # Or via pnpm from the workspace root (if linked correctly)
    # pnpm --filter @sylphlab/tools-memory-mcp start
    ```
    The server will start and listen on stdio. It will create/use `memory.json` in the directory where you run the command.

3.  **Environment Variable (Optional):**
    You can specify a different file path or name relative to the CWD using the `MEMORY_FILE_PATH` environment variable (this is handled by the underlying `@sylphlab/tools-memory` package):
    ```bash
    MEMORY_FILE_PATH=./data/my_memory.json node ./node_modules/.bin/mcp-memory
    ```

## Development

*   **Build:** `pnpm build` (Builds this package and its dependencies)
*   **Watch:** `pnpm dev`
*   **Lint/Format:** `pnpm format`, `pnpm check`

## License

MIT