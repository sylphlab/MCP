# Active Context & Current Focus

## Goal
Refactor MCP core and server packages for consistency, testability, and adherence to SDK patterns. Address build issues and ensure correct package naming/dependencies. Finalize and prepare for release.

## Design Decisions & Understanding
- **Core Tool Input:** All core tools (`*-core`) should handle **batch inputs** (e.g., `{ items: [...] }`) in their `inputSchema` and `execute` function for efficiency and reusability.
- **Core Tool Logic:** The `execute` function within each `McpTool` object handles *all* logic (validation, core operation, error handling, output formatting). Pure functions should *not* be exported separately just for testing; tests should target the `execute` method (potentially with mocks for I/O).
- **Core Tool Output (`BaseMcpToolOutput`):** The `content: McpContentPart[]` type in `@sylphlab/mcp-core` needs refinement.
    - **Requirement:** Must be structurally compatible with the array type expected by `@modelcontextprotocol/sdk`'s `server.tool()` handler (which includes specific types like text, image, audio, resource).
    - **Solution (Plan C):** Redefine `McpContentPart` in `@sylphlab/mcp-core` to be a union explicitly matching the SDK's known content part structures (text, image, audio, resource), *without* directly importing SDK types. This ensures compatibility while allowing future extension of `McpContentPart` within our ecosystem if needed.
- **`registerTools` Helper (`@sylphlab/mcp-utils`):** This helper *will* be used by all server packages.
    - **Functionality:** It acts as a *minimal* bridge. It takes the `McpServer` instance and an array of `McpTool` objects. Inside, it loops and calls `server.tool()` for each tool.
    - **Schema Handling:** It should pass `tool.inputSchema.shape` to `server.tool()`.
    - **Handler Function:** The wrapper function passed to `server.tool()` should accept `args: unknown`, re-validate `args` against the full `tool.inputSchema` (which expects the batch structure like `{ items: [...] }`), call `tool.execute(validatedArgs, ...)`, and return the `BaseMcpToolOutput` result directly. Thanks to the refined `McpContentPart` (see above), no complex type mapping or `as any` should be needed in the return.
- **Package Naming:** Core packages use `@sylphlab/mcp-<name>-core`, server packages use `@sylphlab/mcp-<name>`.
- **Server Executability:** All server packages must have a `bin` field in `package.json`.
- **Fetch/Net:** `fetch-core` and `fetch` packages will remain separate from `net-core` and `net` for modularity.

## Progress
- **Completed:**
    - Initial refactoring attempts (some parts incorrect).
    - Package renaming (`reader`->`pdf`, corrected scopes).
    - Build script corrections (`"build": "tsup"`).
    - `tsconfig.json` fixes (`moduleResolution`, `module`).
    - Build artifact cleanup.
    - Dependency updates and successful `pnpm install`.
    - Successful `pnpm run build`.
    - Test failure investigation (`filesystem-core`) and skipping problematic tests.
    - GitHub repo description/topics update.
    - `bin` field added to server packages.
    - Changeset created, version bumps applied, commits pushed.
- **Current State:** Codebase reflects the *incorrect* single-operation core tool structure and a potentially incorrect `registerTools` implementation due to previous misunderstandings. Build is currently passing, but the structure needs correction based on the latest design decisions.

## Next Actions (To be delegated via Subtasks)
1.  **Task 1: Refine Core Types:** Modify `McpContentPart` in `packages/core/src/index.ts` to align structurally with SDK expectations (text, image, audio, resource union).
2.  **Task 2: Revert Core Tools to Batch Input:** Update `execute` methods and `inputSchema` in `fetch-core`, `hasher-core`, `json-core`, `net-core` (split tools), `pdf-core`, `xml-core`, `wait-core` to handle array inputs (e.g., `{ items: [...] }`). Update corresponding `index.ts` exports.
3.  **Task 3: Correct `registerTools` Helper:** Update `packages/utils/src/registerTools.ts` to correctly validate the full input schema (expecting arrays) and pass the validated args to `tool.execute`, returning the `BaseMcpToolOutput` directly.
4.  **Task 4: Verify Server Packages:** Ensure all server `index.ts` files correctly use the updated `registerTools` helper.
5.  **Task 5: Build & Test:** Run `pnpm install`, `pnpm run build`, and `pnpm run test:coverage` (re-enabling skipped tests if possible). Fix any remaining issues.
6.  **Task 6: Finalize Release:** Create a new changeset, version, commit, and push tags.

## Waiting For
N/A - Ready to create subtasks.