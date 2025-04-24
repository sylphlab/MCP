#!/usr/bin/env node
import process from 'node:process';
// Remove direct SDK imports, factory handles them
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool, ToolExecuteOptions } from '@sylphlab/tools-core';
// Import the server start function
import { startMcpServer } from '@sylphlab/tools-adaptor-mcp';

// Import tool objects from the core library
import { decodeBase64Tool, encodeBase64Tool } from '@sylphlab/tools-base64';
import { description, name, version } from '../package.json'; // Import metadata

// --- Server Setup ---

// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
const tools: Tool<any>[] = [encodeBase64Tool, decodeBase64Tool];

// --- Server Start ---
// Use an async IIFE to handle top-level await for CJS compatibility
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
