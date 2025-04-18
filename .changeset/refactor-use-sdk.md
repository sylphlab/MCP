---
"@sylphlab/mcp-filesystem": patch
---

Refactor filesystem server to use @modelcontextprotocol/sdk.

- Replaced manual stdio handling with McpServer and StdioServerTransport.
- Corrected tool registration to use server.tool() method.
- Fixed server exiting prematurely.