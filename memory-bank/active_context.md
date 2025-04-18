**Current Goal:** Refactor all filesystem-related tools (`filesystem-core` and `reader-core`) to use a centralized path validation utility (`validateAndResolvePath` from `@sylphlab/mcp-core`). This utility should handle an internal `allowOutsideWorkspace` flag passed via an `options` parameter to the `execute` method, keeping the AI-facing Zod schema clean.

**Progress:**
*   Added `validateAndResolvePath` utility to `@sylphlab/mcp-core`.
*   Updated the `McpTool` interface in `@sylphlab/mcp-core` to include `options?: McpToolExecuteOptions` in the `execute` signature and exported `McpToolExecuteOptions`.
*   Successfully refactored **all** tools in `filesystem-core` (source and tests) to use this new pattern, including `statItemsTool.ts` and `writeFilesTool.ts`.
*   Successfully refactored `processReadOperations` in `reader-core` to use the new pattern.
*   Confirmed `validateAndResolvePath` returns `string` on success and `{ error: string, suggestion: string }` on failure.
*   Corrected logic in all three affected files (`statItemsTool.ts`, `writeFilesTool.ts`, `reader-core/src/index.ts`) to handle this return signature correctly.
*   Corrected assertions in `reader-core/src/index.test.ts`.
*   Switched PDF library in `reader-core` from `pdfjs-dist` to `mupdf` and updated tests.
*   Updated the main `reader` tool in `packages/reader` to correctly pass `options` to `processReadOperations`.
*   All tests now pass (`pnpm test`), excluding a pre-existing coverage threshold issue in `filesystem-core`.

**Known Issues:**
*   Coverage threshold failure in `filesystem-core` tests (pre-existing).

**Next Steps:**
1.  **Address Coverage:** (Optional) Investigate and fix the coverage issue in `filesystem-core`.