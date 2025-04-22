#!/usr/bin/env node

// Remove direct SDK imports
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpTool } from '@sylphlab/mcp-core';
// Import the server start function
import { startMcpServer } from '@sylphlab/mcp-utils';

// Import tool objects from the core libraries
import {
  downloadTool, // Add downloadTool import
  fetchTool, // Moved from fetch-core
  getInterfacesTool,
  getPublicIpTool,
} from '@sylphlab/mcp-net-core';
import { description, name, version } from '../package.json'; // Import metadata

// --- Server Setup ---

// Array of imported tool objects
// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
const tools: McpTool<any, any>[] = [getPublicIpTool, getInterfacesTool, fetchTool, downloadTool];

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
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});
process.on('SIGTERM', () => {
  process.exit(0);
});
