# @sylphlab/tools-base64-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-base64-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-base64-mcp)

**Run Base64 encoding and decoding tools via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes Base64 encoding and decoding functionalities defined in `@sylphlab/tools-base64`.

## Purpose

This server allows MCP clients (like AI agents or other applications) to remotely execute Base64 operations. It acts as a bridge, taking the core tool logic from `@sylphlab/tools-base64`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio).

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes Base64 Tools:**
    *   `encodeBase64Tool`: Encodes plain text to Base64.
    *   `decodeBase64Tool`: Decodes Base64 back to plain text.
*   **Executable:** Provides a binary (`mcp-base64`) for easy execution.

## Installation

This package is intended to be used as a standalone server or potentially run via a process manager.

```bash
# Install globally (example, adjust based on your needs)
npm install -g @sylphlab/tools-base64-mcp

# Or run directly using npx (requires Node.js)
npx @sylphlab/tools-base64-mcp
```

Within the monorepo, you can build it using:

```bash
# From the root of the monorepo
pnpm build --filter @sylphlab/tools-base64-mcp
```

## Usage

Once built or installed, you can run the server using the provided binary name:

```bash
mcp-base64
```

The server will start and listen for MCP requests on standard input/output. You would typically configure your MCP client (e.g., an AI agent orchestrator) to connect to this server process.

**Example Client Configuration (Conceptual):**

```json
// Example client config snippet
{
  "servers": [
    {
      "name": "sylphlab-base64",
      "command": ["mcp-base64"] // Command to start the server
    }
    // ... other servers
  ]
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions to MCP format.
*   `@sylphlab/tools-base64`: Contains the actual logic for Base64 encoding/decoding.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.