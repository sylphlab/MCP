---
'@sylphlab/mcp-core': patch
'@sylphlab/mcp-base64-core': patch
'@sylphlab/mcp-net-core': minor
'@sylphlab/mcp-rag-core': patch
'@sylphlab/mcp-fetch': patch
'@sylphlab/mcp-net': patch
'@sylphlab/mcp-filesystem-core': patch
---

feat: Consolidate fetchTool into net-core

Moved the `fetchTool` implementation from the deprecated `fetch-core` package into `net-core`.
Updated `fetch` and `net` server packages to depend on `net-core` for fetch functionality.
Removed the `fetch-core` package entirely.

fix: Align test expectations with defineTool error handling

Corrected error handling logic and test assertions across multiple packages (`filesystem-core`, `base64-core`, `net-core`, `rag-core`) to consistently handle errors thrown by tool `execute` functions and caught by the `defineTool` wrapper. Ensures tests correctly assert against the prefixed error messages returned by the wrapper and handle undefined properties appropriately in error cases.