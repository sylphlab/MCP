# @sylphlab/tools-filesystem

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-filesystem?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-filesystem)

**Core logic for comprehensive filesystem operations.**

This package provides the underlying logic and tool definitions for interacting with the filesystem, designed using `@sylphlab/tools-core`. It forms the foundation for the corresponding MCP server package (`@sylphlab/tools-filesystem-mcp`).

## Purpose

Interacting with the filesystem is a fundamental requirement for many applications and agents. This package offers a suite of standardized tools for common filesystem tasks, ensuring consistency and safety. The tools are defined using `@sylphlab/tools-core`, allowing them to be easily integrated into MCP servers or other platforms via adapters.

## Tools Provided

This package includes a range of tools covering common filesystem needs:

*   **Reading:**
    *   `readFilesTool`: Reads the content of one or more files. Supports encoding options.
    *   `listFilesTool`: Lists files and directories within specified paths, with options for recursion and depth.
    *   `statItemsTool`: Retrieves filesystem statistics (size, type, modification time, etc.) for specified paths.
*   **Writing & Modification:**
    *   `writeFilesTool`: Writes content to one or more files, supporting overwrite and append modes.
    *   `editFileTool`: Applies precise changes to a file using a diff patch format, ensuring context-aware edits.
    *   `replaceContentTool`: Performs search and replace operations within files, supporting text and regular expressions.
*   **Management:**
    *   `createFolderTool`: Creates new directories.
    *   `copyItemsTool`: Copies files or directories from a source to a destination.
    *   `moveRenameItemsTool`: Moves or renames files or directories.
    *   `deleteItemsTool`: Deletes files or directories, typically using the system's trash/recycle bin by default for safety.
*   **Searching:**
    *   `searchContentTool`: Searches for text or patterns within files, supporting context lines and result limits.

*(Note: The exact tool names are based on the source code structure within this package.)*

## Key Features

*   **Comprehensive:** Covers a wide array of common filesystem tasks.
*   **Standardized:** All tools follow the `SylphTool` definition structure from `@sylphlab/tools-core`.
*   **Safe Defaults:** Operations like deletion default to using the trash where possible.
*   **Precise Editing:** Includes a diff-patch based tool for accurate file modifications.
*   **Glob Support:** Leverages `fast-glob` for powerful path matching in relevant tools.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, serving as a dependency for `@sylphlab/tools-filesystem-mcp` and potentially other packages needing direct filesystem logic.

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-filesystem --filter <your-package-name>
```

## Usage (Conceptual)

The tool definitions are typically consumed by adapters or MCP server implementations.

```typescript
import { readFilesTool, writeFilesTool /* ... other tools */ } from '@sylphlab/tools-filesystem';
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using a tool definition directly
async function runReadFile() {
  const input = { paths: ['./my-document.txt'] };
  // Validate input against readFilesTool.inputSchema...
  const output = await readFilesTool.handler(input);
  // Validate output against readFilesTool.outputSchema...
  if (output.results && output.results[0]?.success) {
    console.log(output.results[0].content);
  }
}

// Example: Adapting for MCP
const mcpTools = [
  readFilesTool,
  writeFilesTool,
  listFilesTool,
  // ... other filesystem tools
].map(adaptToolToMcp);

// These adapted definitions would then be used to create the MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides `defineTool` and core types.
*   `zod`: For input/output schema definition and validation.
*   `fast-glob`: For glob pattern matching.
*   `diff-match-patch`: For applying file edits via diffs.
*   `trash`: For safely deleting files by moving them to the trash.

---

Developed by Sylph Lab.