# @sylphlab/tools-filesystem-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-filesystem-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-filesystem-mcp)

**Interact with the filesystem remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes a comprehensive suite of filesystem operations, based on the tools defined in `@sylphlab/tools-filesystem`.

## Purpose

This server allows MCP clients (like AI agents, development tools, or other applications) to securely perform filesystem operations within a designated workspace. It acts as a bridge, taking the core tool logic from `@sylphlab/tools-filesystem`, adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio). This enables remote management of files and directories without granting direct filesystem access to the client.

## Features

*   **MCP Server:** Implements the Model Context Protocol for robust tool execution.
*   **Exposes Filesystem Tools:** Provides tools for:
    *   Reading files (`readFilesTool`)
    *   Writing/Appending to files (`writeFilesTool`)
    *   Listing directory contents (`listFilesTool`)
    *   Getting file/directory stats (`statItemsTool`)
    *   Creating directories (`createFolderTool`)
    *   Copying items (`copyItemsTool`)
    *   Moving/Renaming items (`moveRenameItemsTool`)
    *   Deleting items (safely using trash) (`deleteItemsTool`)
    *   Editing files via diff patches (`editFileTool`)
    *   Searching file content (`searchContentTool`)
    *   Replacing file content (`replaceContentTool`)
*   **Executable:** Provides a binary (`mcp-filesystem`) for easy execution.
*   **Secure:** Operates within the context of the working directory where the server is launched, preventing access outside the intended scope.

## Installation

This package is intended to be used as a standalone server.

**Using npm/pnpm/yarn (Recommended)**

Install as a dependency or globally:

```bash
# Globally
npm install -g @sylphlab/tools-filesystem-mcp
# Or in a project
pnpm add @sylphlab/tools-filesystem-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx` or the installed binary path:

```json
// Using npx
{
  "mcpServers": {
    "filesystem-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-filesystem-mcp"],
      "name": "Filesystem Tools (npx)"
      // "cwd": "/path/to/target/project" // IMPORTANT: Set CWD if needed
    }
  }
}

// Or using global install path (example)
{
  "mcpServers": {
    "filesystem-mcp": {
      "command": "mcp-filesystem", // Assumes it's in PATH
      "name": "Filesystem Tools (Global)"
      // "cwd": "/path/to/target/project" // IMPORTANT: Set CWD if needed
    }
  }
}
```
*Note: Ensure the MCP host configuration specifies the correct `cwd` (Current Working Directory) for the server if it needs to operate outside the host's default directory.*

**Using Docker (If Available)**

*(Requires a Docker image `sylphlab/tools-filesystem-mcp:latest` to be published)*

```bash
docker pull sylphlab/tools-filesystem-mcp:latest
```

Configure your MCP host, mounting the target project directory to `/app`:

```json
{
  "mcpServers": {
    "filesystem-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", // Essential for stdio communication
        "--rm",
        "-v",
        "/path/to/your/project:/app", // Mount the target directory
        "-w", "/app", // Set the working directory inside the container
        "sylphlab/tools-filesystem-mcp:latest"
      ],
      "name": "Filesystem Tools (Docker)"
    }
  }
}
```

**Local Build (For Development)**

1.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-filesystem-mcp`
2.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "filesystem-mcp": {
          "command": "node",
          // Adjust path as needed
          "args": ["./packages/tools-filesystem-mcp/dist/index.js"],
          "name": "Filesystem Tools (Local Build)"
          // "cwd": "/path/to/target/project" // IMPORTANT: Set CWD if needed
        }
      }
    }
    ```

## Usage

Once the server is running and configured in your MCP host, clients can send requests to manipulate files within the server's working directory.

**MCP Request Example (List files):**

```json
{
  "tool_name": "listFilesTool", // Tool name from @sylphlab/tools-filesystem
  "arguments": {
    "paths": ["./src"], // List contents of the 'src' subdirectory
    "recursive": false
  }
}
```

**Expected Response Snippet (Conceptual):**

```json
{
  "result": {
    "./src": {
      "success": true,
      "entries": [
        { "name": "index.ts", "path": "src/index.ts", "isDirectory": false, "isFile": true },
        { "name": "utils", "path": "src/utils", "isDirectory": true, "isFile": false }
        // ... other entries
      ]
    }
  }
}
```

**MCP Request Example (Write file):**

```json
{
  "tool_name": "writeFilesTool",
  "arguments": {
    "items": [
      {
        "path": "./new-file.txt",
        "content": "Hello from MCP!"
      }
    ]
  }
}
```

**Expected Response Snippet (Conceptual):**

```json
{
  "result": {
    "results": [
      { "path": "./new-file.txt", "success": true, "hash": "sha256-..." }
    ]
  }
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions to MCP format.
*   `@sylphlab/tools-filesystem`: Contains the actual logic for filesystem operations.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.