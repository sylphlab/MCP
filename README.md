# Sylph Lab - Model Context Protocol (MCP) Monorepo

This repository contains packages related to the Sylph Lab Model Context Protocol (MCP).

## Overview

MCP defines a standard way for AI models and external tools/servers to communicate, enabling models to leverage external capabilities and resources.

## Packages

This monorepo currently includes the following packages:

-   **`packages/mcp-core`**: Provides core types, schemas, and utilities used by MCP servers and clients.
-   **`packages/filesystem-core`**: Defines the core logic and schemas for filesystem-related MCP tools (e.g., read, write, list files).
-   **`packages/filesystem`**: An example MCP server implementation providing filesystem tools based on `filesystem-core`.
-   **`packages/wait-core-mcp`**: Core logic for the wait tool.
-   **`packages/wait-mcp`**: MCP wait tool package.
-   **`packages/net-core-mcp`**: Core logic for network tools.
-   **`packages/net-mcp`**: MCP network tool package.
-   **`packages/fetch-core-mcp`**: Core logic for the fetch tool.
-   **`packages/fetch-mcp`**: MCP fetch tool package.
-   **`packages/json-core-mcp`**: Core logic for JSON tools.
-   **`packages/json-mcp`**: MCP JSON tool package.
-   **`packages/base64-core-mcp`**: Core logic for Base64 tools.
-   **`packages/base64-mcp`**: MCP Base64 tool package.
-   **`packages/hasher-core-mcp`**: Core logic for hashing tools.
-   **`packages/hasher-mcp`**: MCP hashing tool package.
-   **`packages/xml-core-mcp`**: Core logic for XML tools.
-   **`packages/xml-mcp`**: MCP XML tool package.
-   **`packages/reader-core-mcp`**: Core logic for reader/converter tools.
-   **`packages/reader-mcp`**: MCP reader/converter tool package.

## Development

This project uses `pnpm` for package management and `Turborepo` for managing tasks within the monorepo.

-   Install dependencies: `pnpm install`
-   Build all packages: `pnpm run build`
-   Run tests: `pnpm run test`

*(More details on contribution, setup, and usage can be added later.)*