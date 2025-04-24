# @sylphlab/tools-fetch-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-fetch-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-fetch-mcp)

**Make HTTP requests remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes network fetch capabilities, likely based on the tools defined in `@sylphlab/tools-net`.

## Purpose

This server allows MCP clients (like AI agents or other applications) to request web resources over HTTP/HTTPS. It acts as a secure gateway, taking the core fetch logic from `@sylphlab/tools-net`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio). This is crucial for agents that need to interact with external APIs or retrieve web content but may not have direct network access themselves.

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes Fetch Tool:** Provides a tool (likely named `fetch` or similar) to perform HTTP/HTTPS requests (GET, POST, etc.).
    *   Supports various methods, headers, and body payloads.
    *   Returns response status, headers, and body content.
*   **Executable:** Provides a binary (`mcp-fetch`) for easy execution.
*   **Secure:** Acts as a controlled interface for network requests initiated by an MCP client.

## Installation

This package is intended to be used as a standalone server.

**Using npm/pnpm/yarn (Recommended)**

Install as a dependency or globally:

```bash
# Globally
npm install -g @sylphlab/tools-fetch-mcp
# Or in a project
pnpm add @sylphlab/tools-fetch-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx` or the installed binary path:

```json
// Using npx
{
  "mcpServers": {
    "fetch-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-fetch-mcp"],
      "name": "Fetch Tool (npx)"
    }
  }
}

// Or using global install path (example)
{
  "mcpServers": {
    "fetch-mcp": {
      "command": "mcp-fetch", // Assumes it's in PATH
      "name": "Fetch Tool (Global)"
    }
  }
}
```

**Using Docker (If Available)**

*(Assuming a Docker image `sylphlab/tools-fetch-mcp:latest` exists)*

```bash
docker pull sylphlab/tools-fetch-mcp:latest
```

Configure your MCP host:

```json
{
  "mcpServers": {
    "fetch-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", // Essential for stdio communication
        "--rm",
        "sylphlab/tools-fetch-mcp:latest"
      ],
      "name": "Fetch Tool (Docker)"
    }
  }
}
```

**Local Build (For Development)**

1.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-fetch-mcp`
2.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "fetch-mcp": {
          "command": "node",
          // Adjust path as needed
          "args": ["./packages/tools-fetch-mcp/dist/index.js"],
          "name": "Fetch Tool (Local Build)"
        }
      }
    }
    ```

## Usage

Once the server is running and configured in your MCP host, clients can send requests.

**MCP Request Example (Conceptual GET):**

```json
{
  "tool_name": "fetch", // Assuming tool name is 'fetch'
  "arguments": {
    "url": "https://api.example.com/data",
    "method": "GET",
    "headers": {
      "Accept": "application/json"
    }
  }
}
```

**Expected Response Snippet (Conceptual):**

```json
{
  "result": {
    "status": 200,
    "statusText": "OK",
    "headers": {
      "content-type": "application/json",
      // ... other headers
    },
    "body": "{\"key\":\"value\"}" // Body as string
  }
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions to MCP format.
*   `@sylphlab/tools-net`: Contains the underlying logic for making HTTP requests.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.