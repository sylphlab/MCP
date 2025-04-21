#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpTool } from '@sylphlab/mcp-core';
import { registerTools } from '@sylphlab/mcp-utils'; // Import the helper

// Import the tool object from the core library
import { hashTool } from '@sylphlab/mcp-hasher-core';

// --- Server Setup ---

const serverName = 'hasher';
const serverDescription = 'Provides a tool for computing cryptographic hashes.';
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
    hashTool,
];

// Register tools using the helper function
registerTools(mcpServer, definedTools);

// --- Server Start ---
async function startServer() {
    try {
      const transport = new StdioServerTransport();
      await mcpServer.server.connect(transport);
      console.error(`Hasher MCP Server "${serverName}" v${serverVersion} started successfully via stdio.`);
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
