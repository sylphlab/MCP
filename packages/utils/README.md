# @sylphlab/mcp-utils

Internal shared utilities for MCP server packages within the monorepo.

## Purpose

This package contains helper functions used by the various MCP server implementations (e.g., `@sylphlab/mcp-filesystem`, `@sylphlab/mcp-net`) to reduce boilerplate code, primarily for registering tools with the `@modelcontextprotocol/sdk`.

**Note:** This is an internal utility package and is not intended for direct consumption outside of this monorepo. Core tool packages (`*-core`) do *not* depend on this package.