---
"@sylphlab/mcp-filesystem": patch
"@sylphlab/mcp-filesystem-core": patch
---

Refactor and cleanup server and tool implementations.

- Simplified server startup logic in `filesystem` package.
- Standardized logging (using `console.error`) in tool implementations.
- Ensured all tools return a non-empty `content` array on success.
- Removed commented-out code and diagnostic logs.