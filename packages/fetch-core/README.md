# @sylphlab/mcp-fetch-core

Core logic and schema for the MCP `fetch` tool.

## Tools Provided

-   **`fetchTool`**: Performs a single HTTP(S) fetch request.

## Usage

This package provides the core `McpTool` definition for fetching web resources. The `fetchTool` object, its Zod input schema, and TypeScript types are exported.

These can be imported and used directly or registered with an MCP server implementation, such as `@sylphlab/mcp-fetch`.