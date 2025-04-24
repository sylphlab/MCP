# @sylphlab/tools-xml-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-xml-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-xml-mcp)

**Parse and potentially build XML data remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes XML processing functionalities, based on the tools defined in `@sylphlab/tools-xml`.

## Purpose

This server allows MCP clients (like AI agents interacting with legacy systems, data transformation pipelines, or configuration managers) to remotely parse XML strings into structured objects, and potentially build XML strings from objects. It acts as a secure interface, taking the core XML logic from `@sylphlab/tools-xml`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio).

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes XML Tools:** Provides tools (like `xmlTool` or `parseXml`) for:
    *   Parsing XML strings into JavaScript object representations.
    *   (Potentially) Building XML strings from JavaScript objects.
*   **Executable:** Provides a binary (`mcp-xml`) for easy execution.

## Installation

This package is intended to be used as a standalone server.

**Using npm/pnpm/yarn (Recommended)**

Install as a dependency or globally:

```bash
# Globally
npm install -g @sylphlab/tools-xml-mcp
# Or in a project
pnpm add @sylphlab/tools-xml-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx` or the installed binary path:

```json
// Using npx
{
  "mcpServers": {
    "xml-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-xml-mcp"],
      "name": "XML Tools (npx)"
    }
  }
}

// Or using global install path
{
  "mcpServers": {
    "xml-mcp": {
      "command": "mcp-xml", // If in PATH
      "name": "XML Tools (Global)"
    }
  }
}
```

**Using Docker (If Available)**

*(Requires a Docker image `sylphlab/tools-xml-mcp:latest` to be published)*

```bash
docker pull sylphlab/tools-xml-mcp:latest
```

Configure your MCP host:

```json
{
  "mcpServers": {
    "xml-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", // Essential for stdio communication
        "--rm",
        "sylphlab/tools-xml-mcp:latest"
      ],
      "name": "XML Tools (Docker)"
    }
  }
}
```

**Local Build (For Development)**

1.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-xml-mcp`
2.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "xml-mcp": {
          "command": "node",
          // Adjust path as needed
          "args": ["./packages/tools-xml-mcp/dist/index.js"],
          "name": "XML Tools (Local Build)"
        }
      }
    }
    ```

## Usage

Once the server is running and configured in your MCP host, clients can send requests to process XML data.

**MCP Request Example (Parse XML String):**

```json
{
  "tool_name": "parseXml", // Specific tool name might vary
  "arguments": {
    "xmlString": "<data><user id=\"123\">John Doe</user></data>"
  }
}
```

**Expected Response Snippet:**

```json
{
  "result": {
    "success": true,
    "parsedObject": {
      "data": {
        "user": {
          "_attributes": { "id": "123" },
          "_text": "John Doe"
        }
      }
    }
    // Structure depends on the underlying parser used in @sylphlab/tools-xml
  }
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions to MCP format.
*   `@sylphlab/tools-xml`: Contains the actual logic for XML operations.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.