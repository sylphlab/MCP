# Sylph Lab - Model Context Protocol (MCP) Monorepo

This repository contains packages related to the Sylph Lab Model Context Protocol (MCP).

## Overview

MCP defines a standard way for AI models and external tools/servers to communicate, enabling models to leverage external capabilities and resources. This monorepo provides core libraries defining MCP tools and example server implementations for various functionalities.

## Packages

This monorepo uses a scoped naming convention (`@sylphlab/mcp-<name>`) and separates core tool logic (`*-core`) from the server implementations.

### Core Libraries (`packages/*-core`)

These packages define the core logic, Zod schemas, and TypeScript types for specific MCP tools. They are designed to be potentially reusable outside the provided MCP servers.

-   **`@sylphlab/mcp-core`**: Provides base types, schemas, and utilities used across all MCP packages.
-   **`@sylphlab/mcp-filesystem-core`**: Core logic and schemas for filesystem tools (read, write, list, copy, delete, edit, etc.).
-   **`@sylphlab/mcp-wait-core`**: Core logic and schema for the `wait` tool.
-   **`@sylphlab/mcp-net-core`**: Core logic and schemas for network utility tools (`getPublicIp`, `getInterfaces`).
-   **`@sylphlab/mcp-fetch-core`**: Core logic and schema for the `fetch` tool (HTTP requests).
-   **`@sylphlab/mcp-json-core`**: Core logic and schema for JSON tools (`parse`, `stringify`).
-   **`@sylphlab/mcp-base64-core`**: Core logic and schemas for Base64 tools (`encode`, `decode`).
-   **`@sylphlab/mcp-hasher-core`**: Core logic and schema for hashing tools (`hash`).
-   **`@sylphlab/mcp-xml-core`**: Core logic and schema for XML tools (`parse`).
-   **`@sylphlab/mcp-pdf-core`**: Core logic and schema for PDF tools (`getText`).

### Server Implementations (`packages/<name>`)

These packages implement runnable MCP servers using the `@modelcontextprotocol/sdk` and the tools defined in the corresponding core libraries.

-   **`@sylphlab/mcp-filesystem`**: MCP server providing filesystem tools.
-   **`@sylphlab/mcp-wait`**: MCP server providing the `wait` tool.
-   **`@sylphlab/mcp-net`**: MCP server providing network utility tools (`getPublicIp`, `getInterfaces`).
-   **`@sylphlab/mcp-fetch`**: MCP server providing the `fetch` tool.
-   **`@sylphlab/mcp-json`**: MCP server providing JSON tools.
-   **`@sylphlab/mcp-base64`**: MCP server providing Base64 tools.
-   **`@sylphlab/mcp-hasher`**: MCP server providing the `hash` tool.
-   **`@sylphlab/mcp-xml`**: MCP server providing the `xml` tool.
-   **`@sylphlab/mcp-pdf`**: MCP server providing PDF tools (`getText`).

### Utilities

-   **`@sylphlab/mcp-utils`**: Internal shared utilities, primarily for registering tools with the MCP SDK server instance.

## Development

This project uses `pnpm` for package management and `Turborepo` for managing tasks within the monorepo.

-   Install dependencies: `pnpm install`
-   Build all packages: `pnpm run build`
-   Run tests: `pnpm run test`
-   Run tests with coverage: `pnpm run test:coverage`

*(More details on contribution, setup, and usage can be added later.)*