# Sylph Lab - Model Context Protocol (MCP) Monorepo

This repository contains packages related to the Sylph Lab Model Context Protocol (MCP).

## Overview

MCP defines a standard way for AI models and external tools/servers to communicate, enabling models to leverage external capabilities and resources.

## Packages

This monorepo currently includes the following packages:

-   **`packages/mcp-core`**: Provides core types, schemas, and utilities used by MCP servers and clients.
-   **`packages/filesystem-core`**: Defines the core logic and schemas for filesystem-related MCP tools (e.g., read, write, list files).
-   **`packages/filesystem`**: An example MCP server implementation providing filesystem tools based on `filesystem-core`.

## Development

This project uses `pnpm` for package management and `Turborepo` for managing tasks within the monorepo.

-   Install dependencies: `pnpm install`
-   Build all packages: `pnpm run build`
-   Run tests: `pnpm run test`

*(More details on contribution, setup, and usage can be added later.)*