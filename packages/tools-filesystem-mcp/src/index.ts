#!/usr/bin/env node
import process from 'node:process';
// McpServer and StdioServerTransport are now handled by the factory
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool, ToolExecuteOptions } from '@sylphlab/tools-core';
// Import the server start function
import { startMcpServer } from '@sylphlab/tools-adaptor-mcp';
// Zod imports might not be needed here anymore if server factory handles registration details
// import { ZodObject, ZodRawShape, z } from 'zod';

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
} from '@sylphlab/tools-filesystem';
import { description, name, version } from '../package.json'; // Import version from package.json

// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
const tools: Tool<any>[] = [
  // Add back type annotation and ignore comment
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
]; // Explicitly cast to McpTool array

// --- Server Start ---
// Use an async IIFE to handle top-level await for CJS compatibility
// Error handling (including process.exit) is inside startMcpServer.
(async () => {
  const toolOptions: ToolExecuteOptions = {
    workspaceRoot: process.cwd(),
    // Add other options if needed, e.g., allowOutsideWorkspace: false
  };
  try {
    await startMcpServer(
      {
        // Pass server metadata
        name,
        description,
        version,
        tools,
      },
      toolOptions, // Pass the created options object
    );
    // If the script reaches here, the server started successfully and is running.
  } catch (_error) {
    // startMcpServer now handles process.exit on error, so catch block might be empty
    // or log additional context if needed.
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});
process.on('SIGTERM', () => {
  process.exit(0);
});
