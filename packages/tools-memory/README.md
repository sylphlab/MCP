# @sylphlab/tools-memory

Core logic and tool definitions for Knowledge Graph memory management based on a Property Graph model.

## Overview

This package provides the core functionalities for interacting with a knowledge graph used for AI agent memory, stored in a `memory.jsonl` file. It utilizes a Property Graph model where data is represented as Nodes (with IDs, labels, and key-value properties) and Edges (with type, from/to node IDs, and optional properties).

It defines individual tools (like `create_nodes`, `find_nodes`, `update_node_properties`, etc.) following the `@sylphlab/tools-core` structure. File I/O operations are handled internally by `graphUtils.ts`.

The actual MCP server implementation is handled by `@sylphlab/tools-memory-mcp`, which uses this package.

## Features

*   **Property Graph Model:** Represents knowledge using Nodes (entities) and Edges (relations), both supporting key-value properties.
*   **JSON Lines Storage:** Reads from and writes to a `memory.jsonl` file, making it version-control friendly.
*   **Comprehensive Toolset:** Exports standardized tool objects (`ToolDefinition` from `@sylphlab/tools-core`) for:
    *   **Node CRUD:** `create_nodes`, `get_node`, `update_node_properties`, `replace_node_properties`, `add_node_labels`, `remove_node_labels`, `delete_nodes`.
    *   **Edge CRUD:** `create_edges`, `update_edge_properties`, `replace_edge_properties`, `delete_edges`. (Note: Edge updates/deletes currently rely on generated IDs).
    *   **Querying & Discovery:** `find_nodes` (flexible search), `list_nodes` (by type or all, with pagination), `find_related_nodes` (graph traversal), `list_labels`, `list_relation_types`.
*   **UUID Identifiers:** Nodes and Edges use UUIDs for unique identification.

## Usage

This package is primarily intended to be used by MCP adaptor packages like `@sylphlab/tools-memory-mcp`. It's generally not used directly.

## Development

*   **Build:** `pnpm build`
*   **Watch:** `pnpm dev`
*   **Lint/Format:** `pnpm format`, `pnpm check`
*   **Test:** `pnpm test`

## License

MIT