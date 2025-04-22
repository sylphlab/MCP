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

- **Tool Architecture (Adapter Pattern v7):**
  - **Core Logic:** Tool implementations (`execute` functions) return a `Promise<Part[]>`, where `Part` is a defined union type (text, json, image, audio, fileRef, error).
  - **`jsonPart`:** Includes `value` (the structured data) and `schema` (the Zod schema describing `value`).
  - **Tool Definition:** Includes `name`, `description`, `inputSchema` (Zod), but **no** top-level `outputSchema`. The schema for structured output is attached to the `jsonPart`.
  - **Adapters:** Separate adapters (e.g., in `@sylphlab/mcp-utils` or server packages) convert the `Part[]` array into the specific format required by different AI SDKs (MCP, Vercel AI SDK).
  - **MCP Adapter:** Converts `Part[]` to MCP `CallToolResult` (with `isError?` and `content: McpContentPart[]`). `jsonPart` values are stringified into `TextPart`.
  - **Goal:** Decouple tool logic from specific SDK protocols, support multi-type outputs, provide schema descriptions where applicable.

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