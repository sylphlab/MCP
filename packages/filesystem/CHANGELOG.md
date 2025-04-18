# @sylphlab/mcp-filesystem

## 0.1.2

### Patch Changes

- 05a554a: Refactor and cleanup server and tool implementations.

  - Simplified server startup logic in `filesystem` package.
  - Standardized logging (using `console.error`) in tool implementations.
  - Ensured all tools return a non-empty `content` array on success.
  - Removed commented-out code and diagnostic logs.

- a2219f4: Refactor filesystem server to use @modelcontextprotocol/sdk.

  - Replaced manual stdio handling with McpServer and StdioServerTransport.
  - Corrected tool registration to use server.tool() method.
  - Fixed server exiting prematurely.

- Updated dependencies [05a554a]
  - @sylphlab/mcp-filesystem-core@0.1.2

## 0.1.1

### Patch Changes

- Fix build errors and refactor package structure.

  - Moved server logic from mcp-core to filesystem server.
  - Corrected exports in filesystem-core.
  - Resolved various TypeScript configuration issues.

- Updated dependencies
  - @sylphlab/mcp-core@0.0.1
  - @sylphlab/mcp-filesystem-core@0.1.1
