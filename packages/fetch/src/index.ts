#!/usr/bin/env node

// Remove direct SDK imports
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpTool } from '@sylphlab/mcp-core';
// Import the server start function
import { startMcpServer } from '@sylphlab/mcp-utils';

// Import the tool object from the core library
import { fetchTool } from '@sylphlab/mcp-fetch-core';
import { name, version, description } from '../package.json'; // Import metadata

// --- Server Setup ---

// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
const tools: McpTool<any, any>[] = [fetchTool];

// --- Server Start ---
// Directly call startMcpServer at the top level
(async () => {
  try {
    await startMcpServer({
      name, // Use name from package.json
      version, // Use version from package.json
      description, // Use description from package.json
      tools,
    });
  } catch (_error) {
    // Error handling is inside startMcpServer
    process.exit(1); // Still exit if startMcpServer re-throws (which it shouldn't now)
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});
process.on('SIGTERM', () => {
  process.exit(0);
});
