#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZodObject, ZodRawShape, z } from 'zod'; // Import z
import type { McpTool } from '@sylphlab/mcp-core';
import { registerTools } from '@sylphlab/mcp-utils';

// Import the complete tool objects from the core library
import {
  copyItemsTool,
  createFolderTool,
  deleteItemsTool,
  editFileTool,
  listFilesTool,
  moveRenameItemsTool,
  readFilesTool,
  replaceContentTool,
  searchContentTool,
  statItemsTool,
  writeFilesTool,
} from '@sylphlab/mcp-filesystem-core';

// --- Server Setup ---

const serverName = 'filesystem';
const serverDescription = 'Provides tools for interacting with the local filesystem.';
const serverVersion = '0.1.1'; // Match package.json version

// Instantiate McpServer
const mcpServer = new McpServer(
  {
    name: serverName,
    version: serverVersion,
    description: serverDescription,
  },
  {}, // No options needed here
);

// Array of imported tool objects
const definedTools: McpTool<any, any>[] = [
    copyItemsTool,
    createFolderTool,
    deleteItemsTool,
    editFileTool,
    listFilesTool,
    moveRenameItemsTool,
    readFilesTool,
    replaceContentTool,
    searchContentTool,
    statItemsTool,
    writeFilesTool,
];

// Register tools using the helper
registerTools(mcpServer, definedTools);

// --- Server Start ---
async function startServer() {
    try {
      const transport = new StdioServerTransport();
      await mcpServer.server.connect(transport);
      console.error(`Filesystem MCP Server "${serverName}" v${serverVersion} started successfully via stdio.`);
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