# MCP Filesystem Server (@sylphlab/mcp-filesystem)

[![NPM Version](https://img.shields.io/npm/v/%40sylphlab%2Fmcp-filesystem)](https://www.npmjs.com/package/@sylphlab/mcp-filesystem)
[![MIT licensed](https://img.shields.io/npm/l/%40sylphlab%2Fmcp-filesystem)](./LICENSE)
<!-- TODO: Add Build Status badge -->
<!-- TODO: Add Docker badge once published -->
<!-- <a href="https://glama.ai/mcp/servers/@sylphlab/mcp-filesystem">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@sylphlab/mcp-filesystem/badge" />
</a> -->

**Empower your AI agents (like Cline) with secure, efficient, and token-saving access to your project files.** This Node.js server implements the [Model Context Protocol (MCP)](https://docs.modelcontextprotocol.com/) using the tools from `@sylphlab/mcp-filesystem-core` to provide a robust set of filesystem operations, operating safely within a defined project root directory via stdio.

## Installation & Usage

There are several ways to use the Filesystem MCP Server:

**1. Recommended: `npx` (or `bunx`) via MCP Host Configuration**

The simplest way is via `npx` or `bunx`, configured directly in your MCP host environment (e.g., Cline's `mcp_settings.json`). This ensures you always use the latest version from npm without needing local installation.

_Example (`npx`):_

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@sylphlab/mcp-filesystem"],
      "name": "Filesystem (npx)"
    }
  }
}
```

_Example (`bunx`):_

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "bunx",
      "args": ["@sylphlab/mcp-filesystem"],
      "name": "Filesystem (bunx)"
    }
  }
}
```

**Important:** The server uses its own Current Working Directory (`cwd`) as the project root for all filesystem operations. Ensure your MCP Host (e.g., Cline/VSCode) is configured to launch the command with the `cwd` set to your active project's root directory.

**2. Docker (TODO)**

_(Placeholder: Add Dockerfile, publish image, and provide instructions)_

**3. Local Build (For Development)**

1.  Clone the monorepo: `git clone https://github.com/sylphlab/mcp.git`
2.  Install dependencies: `cd mcp && pnpm install`
3.  Build all packages: `pnpm run build` (or `pnpm --filter @sylphlab/mcp-filesystem build`)
4.  Configure MCP Host:
    ```json
    {
      "mcpServers": {
        "filesystem-local": {
          "command": "node",
          "args": ["/path/to/mcp/repo/packages/filesystem/dist/index.js"],
          "name": "Filesystem (Local Build)"
        }
      }
    }
    ```
    **Note:** Launch the `node` command from the directory you intend as the project root. Alternatively, run `pnpm --filter @sylphlab/mcp-filesystem start` from the project root.

## Features

This server exposes the filesystem tools provided by `@sylphlab/mcp-filesystem-core`, including:
- `copyItemsTool`
- `createFolderTool`
- `deleteItemsTool`
- `editFileTool`
- `listFilesTool`
- `moveRenameItemsTool`
- `readFilesTool`
- `replaceContentTool`
- `searchContentTool`
- `statItemsTool`
- `writeFilesTool`

Refer to the `@sylphlab/mcp-filesystem-core` package README for details on each tool's arguments and behavior.

## Development

This package is part of the `sylphlab/mcp` monorepo.

1.  **Clone the monorepo:** `git clone https://github.com/sylphlab/mcp.git`
2.  **Install dependencies:** `cd mcp && pnpm install`
3.  **Build:** `pnpm --filter @sylphlab/mcp-filesystem build`
4.  **Run Locally:** `pnpm --filter @sylphlab/mcp-filesystem start` (runs `node dist/index.js`)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on the [GitHub repository](https://github.com/sylphlab/mcp).

## License

This project is released under the [MIT License](./LICENSE).