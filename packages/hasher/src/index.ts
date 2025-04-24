#!/usr/bin/env node
import process from 'node:process';
// Remove direct SDK imports
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool, ToolExecuteOptions } from '@sylphlab/mcp-core';
// Import the server start function
import { startMcpServer } from '@sylphlab/tool-adaptor-mcp';

// Import the tool object from the core library
import { hashTool } from '@sylphlab/mcp-hasher-core';
import { description, name, version } from '../package.json'; // Import metadata

// --- Server Setup ---

// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
const tools: Tool<any>[] = [hashTool];

// --- Server Start ---
// Directly call startMcpServer at the top level
(async () => {
  const toolOptions: ToolExecuteOptions = {
    workspaceRoot: process.cwd(),
    // Add other options if needed, e.g., allowOutsideWorkspace: false
  };
  try {
    await startMcpServer(
      {
        name, // Use name from package.json
        version, // Use version from package.json
        description, // Use description from package.json
        tools,
      },
      toolOptions, // Pass the created options object
    );
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
