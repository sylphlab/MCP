# @sylphlab/tools-wait-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-wait-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-wait-mcp)

**Introduce delays remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes a simple "wait" or "delay" functionality, based on the tool defined in `@sylphlab/tools-wait`.

## Purpose

This server allows MCP clients (like AI agents orchestrating multi-step processes, testing frameworks, or rate-limited clients) to remotely pause execution for a specified duration. It acts as a simple utility, taking the core delay logic from `@sylphlab/tools-wait`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio).

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes Wait Tool:** Provides a tool (`waitTool`) to pause execution for a specified number of milliseconds.
*   **Executable:** Provides a binary (`mcp-wait`) for easy execution.

## Installation

This package is intended to be used as a standalone server.

**Using npm/pnpm/yarn (Recommended)**

Install as a dependency or globally:

```bash
# Globally
npm install -g @sylphlab/tools-wait-mcp
# Or in a project
pnpm add @sylphlab/tools-wait-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx` or the installed binary path:

```json
// Using npx
{
  "mcpServers": {
    "wait-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-wait-mcp"],
      "name": "Wait Tool (npx)"
    }
  }
}

// Or using global install path
{
  "mcpServers": {
    "wait-mcp": {
      "command": "mcp-wait", // If in PATH
      "name": "Wait Tool (Global)"
    }
  }
}
```

**Using Docker (If Available)**

*(Requires a Docker image `sylphlab/tools-wait-mcp:latest` to be published)*

```bash
docker pull sylphlab/tools-wait-mcp:latest
```

Configure your MCP host:

```json
{
  "mcpServers": {
    "wait-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", // Essential for stdio communication
        "--rm",
        "sylphlab/tools-wait-mcp:latest"
      ],
      "name": "Wait Tool (Docker)"
    }
  }
}
```

**Local Build (For Development)**

1.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-wait-mcp`
2.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "wait-mcp": {
          "command": "node",
          // Adjust path as needed
          "args": ["./packages/tools-wait-mcp/dist/index.js"],
          "name": "Wait Tool (Local Build)"
        }
      }
    }
    ```

## Usage

Once the server is running and configured in your MCP host, clients can send requests to pause execution.

**MCP Request Example (Wait for 1.5 seconds):**

```json
{
  "tool_name": "waitTool", // Tool name from @sylphlab/tools-wait
  "arguments": {
    "durationMs": 1500
  }
}
```

**Expected Response Snippet:**

```json
{
  "result": {
    "success": true,
    "message": "Waited for 1500ms"
  }
}
```
*(The exact success message might vary based on the implementation in `@sylphlab/tools-wait`)*

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definition to MCP format.
*   `@sylphlab/tools-wait`: Contains the actual logic for the delay.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.