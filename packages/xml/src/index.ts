#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpTool } from '@sylphlab/mcp-core';
import { registerTools } from '@sylphlab/mcp-utils'; // Import the helper

// Import the tool object from the core library
import { xmlTool } from '@sylphlab/mcp-xml-core';

// --- Server Setup ---

const serverName = 'xml';
const serverDescription = 'Provides tools for XML operations (parse).';
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
const definedTools: McpTool<any, any>[] = [xmlTool];

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
