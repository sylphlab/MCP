# MCP Filesystem Core Library (@sylphlab/mcp-filesystem-core)

[![NPM Version](https://img.shields.io/npm/v/%40sylphlab%2Fmcp-filesystem-core)](https://www.npmjs.com/package/@sylphlab/mcp-filesystem-core)
[![MIT licensed](https://img.shields.io/npm/l/%40sylphlab%2Fmcp-filesystem-core)](./LICENSE)
<!-- TODO: Add Build Status badge -->

**Core library providing secure, efficient, and batch-capable filesystem tools for the [Model Context Protocol (MCP)](https://docs.modelcontextprotocol.com/).**

This package contains the implementation of various filesystem tools, built with TypeScript and Zod for validation. It is intended to be used as a dependency by runnable MCP server packages (like `@sylphlab/mcp-filesystem`).

## Why Use This Library?

- **🛡️ Secure by Design:** Operations are intended to be confined within a workspace root defined by the hosting MCP server. Path validation helps prevent directory traversal.
- **⚡ Optimized & Consolidated:** Many tools support batch operations (operating on multiple files/paths in one call), reducing AI-server round trips, saving tokens and latency compared to individual shell commands. Detailed results are returned for each item in a batch.
- **✅ Robust Validation:** Uses Zod schemas for input argument validation, ensuring tools receive correctly structured data.
- **🔧 Comprehensive Functionality:** Covers a wide range of common filesystem tasks needed by AI agents working on codebases or projects.
- **⌨️ Strongly Typed:** Written in TypeScript with strict settings for better developer experience and fewer runtime errors.

## Features / Exported Tools

This package exports individual tool objects, each containing:
- `name`: The tool name (e.g., `copyItemsTool`).
- `description`: A description of the tool's purpose.
- `inputSchema`: A Zod schema defining the expected input arguments.
- `execute`: An async function that performs the tool's action.

**Available Tools:**

- `copyItemsTool`: Copies one or more files or folders. Handles recursion.
- `createFolderTool`: Creates one or more new folders, including intermediate parents.
- `deleteItemsTool`: Deletes specified files or directories. Supports `useTrash` (via `trash` package) and `recursive` options.
- `editFileTool`: Applies selective edits (insert, delete lines, replace lines, search/replace text, search/replace regex) to one or more files.
- `listFilesTool`: Lists files and directories within specified paths, with options for recursion, max depth, and including file stats.
- `moveRenameItemsTool`: Moves or renames one or more files or folders. Handles overwriting and creates parent directories.
- `readFilesTool`: Reads the content of one or more files (supports 'utf-8' and 'base64' encoding). Can optionally include file stats.
- `replaceContentTool`: Performs search and replace operations (text or regex) across multiple files matched by glob patterns.
- `searchContentTool`: Searches for content (text or regex) within multiple files matched by glob patterns. Provides context lines and result limits.
- `statItemsTool`: Gets file system stats (`fs.Stats`) for one or more specified paths.
- `writeFilesTool`: Writes or append string content to one or more files (supports 'utf-8' and 'base64' encoding). Creates parent directories.

**Key Benefit:** Tools operating on multiple items (`items` or `paths` arrays) process each item individually and return a detailed status report in the `results` array, indicating success or failure for each specific operation.

## Installation (within Monorepo)

This package is intended for internal use within the `sylphlab/mcp` monorepo. Other packages (like the server package) should depend on it using the `workspace:*` protocol.

```bash
# Add to another workspace package
pnpm add @sylphlab/mcp-filesystem-core@workspace:* --filter <your-package-name>
```

## Usage (Importing Tools)

Import the tool objects into your MCP server implementation:

```typescript
import {
  copyItemsTool,
  createFolderTool,
  // ... import other tools
} from "@sylphlab/mcp-filesystem-core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "MyServer", version: "1.0.0" });

// Register the imported tool
server.tool(
  copyItemsTool.name,
  copyItemsTool.inputSchema,
  async (args) => {
    const workspaceRoot = process.cwd(); // Determine workspace root securely
    return await copyItemsTool.execute(args, workspaceRoot);
  }
);

// ... register other tools
```

## Development

This package is part of the `sylphlab/mcp` monorepo.

1.  **Clone the monorepo:** `git clone https://github.com/sylphlab/mcp.git`
2.  **Install dependencies:** `cd mcp && pnpm install`
3.  **Build:** `pnpm --filter @sylphlab/mcp-filesystem-core build`
4.  **Test:** `pnpm --filter @sylphlab/mcp-filesystem-core test`

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on the [GitHub repository](https://github.com/sylphlab/mcp).

## License

This project is released under the [MIT License](./LICENSE).