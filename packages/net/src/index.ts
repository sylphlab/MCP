#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpTool } from '@sylphlab/mcp-core';
import { registerTools } from '@sylphlab/mcp-utils'; // Import the helper

import { fetchTool } from '@sylphlab/mcp-fetch-core'; // Import fetchTool
// Import tool objects from the core libraries
import {
  downloadTool, // Add downloadTool import
  getInterfacesTool,
  getPublicIpTool,
} from '@sylphlab/mcp-net-core';

// --- Server Setup ---

const serverName = 'net';
// Updated description to reflect available tools
const serverDescription =
  'Provides tools for network operations (fetch, download, get public IP, list interfaces).';
const serverVersion = '0.1.0'; // TODO: Update version as needed

// Instantiate McpServer
const mcpServer = new McpServer(
  {
    name: serverName,
    version: serverVersion,
    description: serverDescription,
  },
  {},
);

// Array of imported tool objects
// biome-ignore lint/suspicious/noExplicitAny: Tool array holds diverse tools; types checked by registerTools
const definedTools: McpTool<any, any>[] = [
  getPublicIpTool,
  getInterfacesTool,
  fetchTool, // Added fetchTool
  downloadTool, // Add downloadTool
];

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
