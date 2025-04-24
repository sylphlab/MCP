# @sylphlab/tools-net-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-net-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-net-mcp)

**Perform network operations remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes network functionalities like HTTP fetching, IP address retrieval, and file downloading, based on the tools defined in `@sylphlab/tools-net`.

## Purpose

This server allows MCP clients (like AI agents, monitoring tools, or deployment scripts) to remotely perform network tasks. It acts as a secure interface, taking the core network logic from `@sylphlab/tools-net`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio). This enables clients to interact with the network or gather network information without requiring direct network access or specific libraries on the client side.

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes Network Tools:** Provides tools for:
    *   Fetching web content (`fetchTool`).
    *   Getting the server's public IP address (`getPublicIpTool`).
    *   Listing the server's network interfaces (`getInterfacesTool`).
    *   Downloading files from URLs (`downloadTool`).
*   **Executable:** Provides a binary (`mcp-net`) for easy execution.

## Installation

This package is intended to be used as a standalone server.

**Using npm/pnpm/yarn (Recommended)**

Install as a dependency or globally:

```bash
# Globally
npm install -g @sylphlab/tools-net-mcp
# Or in a project
pnpm add @sylphlab/tools-net-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx` or the installed binary path:

```json
// Using npx
{
  "mcpServers": {
    "net-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-net-mcp"],
      "name": "Network Tools (npx)"
    }
  }
}

// Or using global install path
{
  "mcpServers": {
    "net-mcp": {
      "command": "mcp-net", // If in PATH
      "name": "Network Tools (Global)"
    }
  }
}
```

**Using Docker (If Available)**

*(Requires a Docker image `sylphlab/tools-net-mcp:latest` to be published)*

```bash
docker pull sylphlab/tools-net-mcp:latest
```

Configure your MCP host:

```json
{
  "mcpServers": {
    "net-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", // Essential for stdio communication
        "--rm",
        // Network host might be needed for interface/IP tools
        // "--network=host",
        "sylphlab/tools-net-mcp:latest"
      ],
      "name": "Network Tools (Docker)"
    }
  }
}
```
*Note: Depending on which tools are used (e.g., `getInterfacesTool`), Docker might require specific network configurations like `--network=host`.*

**Local Build (For Development)**

1.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-net-mcp`
2.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "net-mcp": {
          "command": "node",
          // Adjust path as needed
          "args": ["./packages/tools-net-mcp/dist/index.js"],
          "name": "Network Tools (Local Build)"
        }
      }
    }
    ```

## Usage

Once the server is running and configured in your MCP host, clients can send requests to perform network operations.

**MCP Request Example (Fetch Data):**

```json
{
  "tool_name": "fetchTool",
  "arguments": {
    "url": "https://api.github.com/users/octocat",
    "method": "GET",
    "headers": { "User-Agent": "SylphLab-MCP-Client" }
  }
}
```

**Expected Response Snippet (Fetch):**

```json
{
  "result": {
    "status": 200,
    "statusText": "OK",
    "headers": { ... },
    "body": "{ \"login\": \"octocat\", ... }"
  }
}
```

**MCP Request Example (Get Public IP):**

```json
{
  "tool_name": "getPublicIpTool",
  "arguments": {}
}
```

**Expected Response Snippet (Get Public IP):**

```json
{
  "result": {
    "success": true,
    "ip": "123.45.67.89" // The server's public IP
  }
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions to MCP format.
*   `@sylphlab/tools-net`: Contains the actual logic for network operations.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.