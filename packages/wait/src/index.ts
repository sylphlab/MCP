#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpTool } from '@sylphlab/mcp-core';
import { registerTools } from '@sylphlab/mcp-utils'; // Import the helper

// Import the tool object from the core library
import { waitTool } from '@sylphlab/mcp-wait-core';

// --- Server Setup ---

const serverName = 'wait';
const serverDescription = 'Provides a tool to pause execution for a specified duration.';
const serverVersion = '0.1.0'; // TODO: Update version as needed

// Instantiate McpServer
const mcpServer = new McpServer(
  {
    name: serverName,
    version: serverVersion,
    description: serverDescription,
  },
  {}, // No options needed here
);

// Array of imported tool objects (only one for this package)
// biome-ignore lint/suspicious/noExplicitAny: Tool array holds diverse tools; types checked by registerTools
const definedTools: McpTool<any, any>[] = [waitTool];

// Register tools using the helper function
registerTools(mcpServer, definedTools);

// --- Server Start ---
async function startServer() {
  try {
    const transport = new StdioServerTransport();
    await mcpServer.server.connect(transport);
  } catch (_error: unknown) {
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});
process.on('SIGTERM', () => {
  process.exit(0);
});
