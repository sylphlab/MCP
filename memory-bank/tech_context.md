# Technical Context

**Core Technology Stack:**
- **Runtime:** Node.js (LTS recommended)
- **Language:** TypeScript (Strict)
- **Package Manager:** pnpm
- **Monorepo Tool:** Turborepo
- **Testing Framework:** Vitest
- **Build Tool:** tsup
- **Versioning/Publishing:** Changesets

**Architecture:**
- **Pattern:** Monorepo using pnpm workspaces.
- **Task Runner:** Turborepo manages build, test, lint tasks across packages.

**Key Packages:**
- **`@sylphlab/mcp-core` (in `packages/core`):** Shared types and interfaces.
  - Dependencies: `zod`
  - Dev Dependencies: `tsup`, `typescript`
- **`@sylphlab/mcp-filesystem-core` (in `packages/filesystem-core`):** Filesystem tool implementations (library).
  - Dependencies: `@sylphlab/mcp-core@workspace:*`, `fast-glob`, `trash`, `zod`
  - Dev Dependencies: `@types/node`, `typescript`, `vitest`, `@vitest/coverage-v8`, `tsup`
- **`@sylphlab/mcp-filesystem` (in `packages/filesystem-server`):** Runnable MCP server.
  - Dependencies: `@sylphlab/mcp-core@workspace:*`, `@sylphlab/mcp-filesystem-core@workspace:*`, `@modelcontextprotocol/sdk`
  - Dev Dependencies: `tsup`, `typescript`

**Dev Dependencies (Root):** `turbo`, `@changesets/cli`

**Target Environment:** Node.js environments where MCP servers run.