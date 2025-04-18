# Project Brief: MCP Filesystem Tools

**Goal:** Create a robust, well-tested, strictly-typed monorepo for Node.js-based MCP filesystem tools.

**Scope:**
- Package Name: `@sylphlab/mcp-filesystem`
- Organization: `@sylphlab`
- Contact: hi@sylphlab.com

**Core Requirements:**
- **Monorepo:** Use pnpm workspaces and Turborepo.
- **Language:** TypeScript (strict mode, no `any`/`unknown`).
- **Testing:** Vitest framework, aiming for >90% test coverage.
- **Versioning:** Changesets for managing versions and publishing.
- **Platform:** Node.js (LTS recommended).

**Tools to Implement:**
- `copyItemsTool`: Copy files/folders.
- `createFolderTool`: Create folders.
- `deleteItemsTool`: Delete files/folders (supports globs).
- `editFileTool`: Selective file edits (insert, delete, replace).
- `listFilesTool`: List files/directories.
- `moveRenameItemsTool`: Move/rename files/folders.
- `readFilesTool`: Read file contents.
- `replaceContentTool`: Search and replace in files (supports globs).
- `searchContentTool`: Search content in files (supports globs).
- `statItemsTool`: Get file/directory stats.
- `writeFilesTool`: Write/append to files.