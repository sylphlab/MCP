# @sylphlab/mcp-net-core

Core logic and schemas for MCP tools related to network operations.

## Tools Provided

-   **`getPublicIpTool`**: Retrieves the public IP address of the server machine.
-   **`getInterfacesTool`**: Retrieves details about the server machine's network interfaces.
-   *(Note: `fetchTool` was moved to `@sylphlab/mcp-fetch-core`)*

## Usage

This package provides the core `McpTool` definitions. The tool objects (e.g., `getPublicIpTool`), Zod input schemas, and TypeScript types are exported.

These can be imported and used directly or registered with an MCP server implementation, such as `@sylphlab/mcp-net`.