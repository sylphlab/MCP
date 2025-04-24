# @sylphlab/tools-net

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-net?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-net)

**Core logic for network operations like HTTP requests and IP information retrieval.**

This package provides the underlying logic and tool definitions for performing common network tasks. It's designed using `@sylphlab/tools-core` and serves as the foundation for MCP server packages like `@sylphlab/tools-net-mcp` and `@sylphlab/tools-fetch-mcp`.

## Purpose

Network interaction is crucial for agents and applications needing external data or services. This package offers standardized tools for:

*   Fetching content from URLs via HTTP/HTTPS.
*   Retrieving information about the host system's network interfaces.
*   Discovering the host system's public IP address.
*   Downloading files from URLs.

By defining these tools with `@sylphlab/tools-core`, the logic becomes reusable and adaptable for various platforms.

## Tools Provided

*   `fetchTool`: Performs HTTP/HTTPS requests (GET, POST, PUT, DELETE, etc.) to specified URLs, allowing configuration of method, headers, and body. Returns response status, headers, and body content.
*   `getPublicIpTool`: Retrieves the public IP address of the machine running the tool's handler.
*   `getInterfacesTool`: Lists the network interfaces available on the machine running the tool's handler, along with their IP addresses and other details.
*   `downloadTool`: Downloads a file from a given URL to a specified local path (within the allowed workspace).

## Key Features

*   **HTTP Requests:** Flexible `fetchTool` for interacting with web APIs and resources.
*   **Network Information:** Tools to discover local and public IP configurations.
*   **File Downloads:** Utility for retrieving files from the web.
*   **Standardized Definition:** Uses the `SylphTool` structure from `@sylphlab/tools-core`.
*   **Node.js Based:** Leverages Node.js built-in modules (`fetch`, `os`) for core functionality.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, serving as a dependency for MCP server packages that expose network capabilities.

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-net --filter <your-package-name>
```

## Usage (Conceptual)

The tool definitions are typically consumed by adapters or MCP server implementations.

```typescript
import { fetchTool, getPublicIpTool /* ... other tools */ } from '@sylphlab/tools-net';
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using fetchTool definition directly
async function runFetch() {
  const input = { url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET' };
  // Validate input against fetchTool.inputSchema...
  const output = await fetchTool.handler(input);
  // Validate output against fetchTool.outputSchema...
  if (output.status === 200) {
    console.log('Status:', output.status);
    console.log('Body:', output.body);
  } else {
    console.error('Fetch failed:', output.statusText);
  }
}

// Example: Adapting for MCP
const mcpNetTools = [
  fetchTool,
  getPublicIpTool,
  getInterfacesTool,
  downloadTool
].map(adaptToolToMcp);

// These adapted definitions would then be used to create an MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides `defineTool` and core types.
*   `zod`: For input/output schema definition and validation.

---

Developed by Sylph Lab.