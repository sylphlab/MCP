# @sylphlab/tools-hasher-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-hasher-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-hasher-mcp)

**Generate cryptographic hashes remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes hashing functionalities (MD5, SHA-256, SHA-512) based on the tools defined in `@sylphlab/tools-hasher`.

## Purpose

This server allows MCP clients (like AI agents, build tools, or verification scripts) to remotely calculate cryptographic hashes of strings. It acts as a secure interface, taking the core hashing logic from `@sylphlab/tools-hasher`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio). This is useful for tasks requiring hash generation without exposing the hashing implementation directly to the client or when the client environment lacks native crypto capabilities.

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes Hash Tool:** Provides a tool (likely `hashTool`) to generate hashes using various algorithms.
    *   Supports `md5`, `sha256`, `sha512`.
    *   Accepts string input.
    *   Returns the hexadecimal hash string.
*   **Executable:** Provides a binary (`mcp-hasher`) for easy execution.

## Installation

This package is intended to be used as a standalone server.

**Using npm/pnpm/yarn (Recommended)**

Install as a dependency or globally:

```bash
# Globally
npm install -g @sylphlab/tools-hasher-mcp
# Or in a project
pnpm add @sylphlab/tools-hasher-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx` or the installed binary path:

```json
// Using npx
{
  "mcpServers": {
    "hasher-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-hasher-mcp"],
      "name": "Hasher Tool (npx)"
    }
  }
}

// Or using global install path
{
  "mcpServers": {
    "hasher-mcp": {
      "command": "mcp-hasher", // If in PATH
      "name": "Hasher Tool (Global)"
    }
  }
}
```

**Using Docker (If Available)**

*(Requires a Docker image `sylphlab/tools-hasher-mcp:latest` to be published)*

```bash
docker pull sylphlab/tools-hasher-mcp:latest
```

Configure your MCP host:

```json
{
  "mcpServers": {
    "hasher-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", // Essential for stdio communication
        "--rm",
        "sylphlab/tools-hasher-mcp:latest"
      ],
      "name": "Hasher Tool (Docker)"
    }
  }
}
```

**Local Build (For Development)**

1.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-hasher-mcp`
2.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "hasher-mcp": {
          "command": "node",
          // Adjust path as needed
          "args": ["./packages/tools-hasher-mcp/dist/index.js"],
          "name": "Hasher Tool (Local Build)"
        }
      }
    }
    ```

## Usage

Once the server is running and configured in your MCP host, clients can send requests to generate hashes.

**MCP Request Example (SHA-256):**

```json
{
  "tool_name": "hashTool", // Tool name from @sylphlab/tools-hasher
  "arguments": {
    "text": "Calculate the hash of this string.",
    "algorithm": "sha256"
  }
}
```

**Expected Response Snippet:**

```json
{
  "result": {
    "success": true,
    "hash": "..." // The resulting SHA-256 hash string
  }
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions to MCP format.
*   `@sylphlab/tools-hasher`: Contains the actual logic for generating hashes.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.