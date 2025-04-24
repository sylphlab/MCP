# @sylphlab/tools-json-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-json-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-json-mcp)

**Manipulate JSON data remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes JSON processing functionalities (like parsing, stringifying, potentially diff/patch) based on the tools defined in `@sylphlab/tools-json`.

## Purpose

This server allows MCP clients (like AI agents, data processing pipelines, or development tools) to remotely perform operations on JSON data. It acts as a secure interface, taking the core JSON logic from `@sylphlab/tools-json`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio). This enables clients to work with JSON without needing local JSON parsing libraries or handling complex data transformations directly.

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes JSON Tools:** Provides tools for:
    *   Parsing JSON strings into objects/values.
    *   Stringifying JavaScript objects/values into JSON strings.
    *   (Potentially) Diffing and patching JSON objects.
*   **Executable:** Provides a binary (`mcp-json`) for easy execution.

## Installation

This package is intended to be used as a standalone server.

**Using npm/pnpm/yarn (Recommended)**

Install as a dependency or globally:

```bash
# Globally
npm install -g @sylphlab/tools-json-mcp
# Or in a project
pnpm add @sylphlab/tools-json-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx` or the installed binary path:

```json
// Using npx
{
  "mcpServers": {
    "json-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-json-mcp"],
      "name": "JSON Tools (npx)"
    }
  }
}

// Or using global install path
{
  "mcpServers": {
    "json-mcp": {
      "command": "mcp-json", // If in PATH
      "name": "JSON Tools (Global)"
    }
  }
}
```

**Using Docker (If Available)**

*(Requires a Docker image `sylphlab/tools-json-mcp:latest` to be published)*

```bash
docker pull sylphlab/tools-json-mcp:latest
```

Configure your MCP host:

```json
{
  "mcpServers": {
    "json-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", // Essential for stdio communication
        "--rm",
        "sylphlab/tools-json-mcp:latest"
      ],
      "name": "JSON Tools (Docker)"
    }
  }
}
```

**Local Build (For Development)**

1.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-json-mcp`
2.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "json-mcp": {
          "command": "node",
          // Adjust path as needed
          "args": ["./packages/tools-json-mcp/dist/index.js"],
          "name": "JSON Tools (Local Build)"
        }
      }
    }
    ```

## Usage

Once the server is running and configured in your MCP host, clients can send requests to process JSON data.

**MCP Request Example (Parse JSON String):**

```json
{
  "tool_name": "parseJson", // Specific tool name might vary
  "arguments": {
    "jsonString": "{\"name\": \"Example\", \"value\": 42}"
  }
}
```

**Expected Response Snippet:**

```json
{
  "result": {
    "success": true,
    "parsedObject": {
      "name": "Example",
      "value": 42
    }
  }
}
```

**MCP Request Example (Stringify Object):**

```json
{
  "tool_name": "stringifyJson", // Specific tool name might vary
  "arguments": {
    "object": { "name": "Example", "value": 42 },
    "pretty": true // Optional formatting
  }
}
```

**Expected Response Snippet:**

```json
{
  "result": {
    "success": true,
    "jsonString": "{\n  \"name\": \"Example\",\n  \"value\": 42\n}"
  }
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions to MCP format.
*   `@sylphlab/tools-json`: Contains the actual logic for JSON operations.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.