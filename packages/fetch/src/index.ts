#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpTool } from '@sylphlab/mcp-core';
import { registerTools } from '@sylphlab/mcp-utils'; // Import the helper

// Import the tool object from the core library
import { fetchTool } from '@sylphlab/mcp-fetch-core'; // Changed back

// --- Server Setup ---

const serverName = 'fetch';
const serverDescription = 'Provides a tool to perform HTTP fetch requests.';
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
const definedTools = [fetchTool];

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
