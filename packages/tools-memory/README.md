# @sylphlab/tools-memory

Core logic and tool definitions for Knowledge Graph memory management.

## Overview

This package provides the core functionalities for interacting with a knowledge graph used for AI agent memory. It includes the `KnowledgeGraphManager` class for handling data persistence (reading/writing to a JSON file) and defines the individual tools (like `createEntities`, `searchNodes`, etc.) following the `@sylphlab/tools-core` structure.

The actual MCP server implementation is handled by `@sylphlab/tools-memory-mcp`, which uses this package.

## Features

*   **Knowledge Graph Logic:** Implements CRUD operations (Create, Read, Update, Delete) for entities, relations, and observations.
*   **CWD-based Storage:** The `KnowledgeGraphManager` is designed to store data relative to a provided workspace root (typically `process.cwd()`).
*   **Tool Definitions:** Exports standardized tool objects (`Tool` interface from `@sylphlab/tools-core`) for each knowledge graph operation.

## Usage

This package is primarily intended to be used by MCP adaptor packages like `@sylphlab/tools-memory-mcp`. It's generally not used directly.

## Development

*   **Build:** `pnpm build`
*   **Watch:** `pnpm dev`
*   **Lint/Format:** `pnpm format`, `pnpm check`
*   **Test:** `pnpm test`

## License

MIT