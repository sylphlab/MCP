# @sylphlab/tools-adaptor-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-adaptor-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-adaptor-mcp)

**Bridge the gap between SylphLab Tools and the Model Context Protocol (MCP)!**

This package provides essential adapter functions to seamlessly convert tool definitions created using `@sylphlab/tools-core` into the format required by the `@modelcontextprotocol/sdk`. It's a crucial internal component for building MCP-compliant tool servers within the SylphLab ecosystem.

## Purpose

When building tools using the `@sylphlab/tools-core` `defineTool` function, you get a standardized tool definition object. However, to expose these tools via an MCP server, they need to conform to the schema expected by the MCP SDK.

`@sylphlab/tools-adaptor-mcp` handles this conversion, translating the input/output schemas (often defined using Zod) and other metadata into the structure the MCP server understands.

## Key Features

*   **Automatic Conversion:** Takes a `SylphTool` definition and outputs an MCP-compatible tool definition.
*   **Schema Translation:** Handles the conversion of Zod schemas (used in `@sylphlab/tools-core`) into JSON Schema format suitable for MCP.
*   **Metadata Mapping:** Correctly maps tool names, descriptions, and parameters.
*   **Simplifies MCP Server Creation:** Abstracts away the complexities of manual tool definition conversion, allowing developers to focus on the tool's core logic.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo. If you are developing a new MCP tool server package within this repository, you can add it as a dependency:

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-adaptor-mcp --filter <your-new-mcp-package-name>
```

## Usage (Conceptual)

Typically, you would use this adapter within the main file of an MCP server package (e.g., `packages/tools-filesystem-mcp/src/index.ts`):

```typescript
import { createMcpServer } from '@modelcontextprotocol/sdk/server';
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp';
import { filesystemTools } from '@sylphlab/tools-filesystem'; // Assuming this exports an array of SylphTool definitions

// Adapt each SylphTool definition to the MCP format
const mcpTools = filesystemTools.map(adaptToolToMcp);

// Create the MCP server instance
const server = createMcpServer({
  name: 'sylphlab-filesystem',
  description: 'Provides filesystem tools via MCP',
  tools: mcpTools,
  // ... other server options
});

// Start the server
server.start();
```

*(Note: The actual implementation might vary based on the specific server setup.)*

## Dependencies

*   `@modelcontextprotocol/sdk`: The core SDK for building MCP servers and clients.
*   `@sylphlab/tools-core`: Provides the base `SylphTool` definition format.
*   `zod`: Used for schema definition and validation.

---

Developed by Sylph Lab.