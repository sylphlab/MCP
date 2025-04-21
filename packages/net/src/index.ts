#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpTool } from '@sylphlab/mcp-core';
import { registerTools } from '@sylphlab/mcp-utils'; // Import the helper

// Import tool objects from the core libraries
import {
  getPublicIpTool,
  getInterfacesTool,
  downloadTool // Add downloadTool import
} from '@sylphlab/mcp-net-core';
import { fetchTool } from '@sylphlab/mcp-fetch-core'; // Import fetchTool

// --- Server Setup ---

const serverName = 'net';
// Updated description to reflect available tools
const serverDescription = 'Provides tools for network operations (fetch, download, get public IP, list interfaces).';
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
      console.error(`Net MCP Server "${serverName}" v${serverVersion} started successfully via stdio.`);
      console.error('Waiting for requests...');
    } catch (error: unknown) {
      console.error('Server failed to start:', error);
      process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
    console.error('Received SIGINT. Exiting...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.error('Received SIGTERM. Exiting...');
    process.exit(0);
});
