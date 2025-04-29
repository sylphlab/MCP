#!/usr/bin/env node
import process from 'node:process';
import { startMcpServer } from '@sylphlab/tools-adaptor-mcp';
import type { ToolDefinition, ToolExecuteOptions } from '@sylphlab/tools-core'; // Use ToolDefinition
import { description, name, version } from '../package.json'; // Import metadata

// Import all defined tools from the core memory package
import {
  createEntitiesTool,
  createRelationsTool,
  addObservationsTool,
  deleteEntitiesTool,
  deleteObservationsTool,
  deleteRelationsTool,
  readGraphTool,
  searchNodesTool,
  openNodesTool,
} from '@sylphlab/tools-memory';

// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
// Use <any, any> to allow tools with different context schemas in the array
const tools: ToolDefinition<any, any>[] = [
  createEntitiesTool,
  createRelationsTool,
  addObservationsTool,
  deleteEntitiesTool,
  deleteObservationsTool,
  deleteRelationsTool,
  readGraphTool,
  searchNodesTool,
  openNodesTool,
];

// --- Server Start ---
(async () => {
  // Define the specific options type for memory tools
  // We need to cast the base options to this type when passing to startMcpServer
  // if startMcpServer doesn't directly support generic options.
  // However, let's assume the adaptor passes the options object as-is.
  const toolOptions: ToolExecuteOptions & { memoryFilePath?: string } = { // Inline extend or use imported MemoryToolExecuteOptions if possible
    workspaceRoot: process.cwd(),
    memoryFilePath: process.env.MEMORY_FILE_PATH, // Read env var here
    // allowOutsideWorkspace could be set here if needed, defaults to false
  };

  try {
    await startMcpServer(
      {
        // Pass server metadata and tools array
        name, // From package.json
        description, // From package.json
        version, // From package.json
        tools,
      },
      toolOptions, // Pass execution options
    );
    // Server started successfully
    console.error(`[${name}] MCP server started successfully on stdio.`);
  } catch (error) {
    // startMcpServer handles logging and process.exit on critical startup errors
    // Log additional context here if necessary
    console.error(`[${name}] Failed to start MCP server:`, error);
    // Ensure process exits if startMcpServer somehow doesn't
    process.exit(1);
  }
})();

// Graceful shutdown (optional, startMcpServer might handle some signals)
process.on('SIGINT', () => {
  console.error(`[${name}] Received SIGINT. Shutting down...`);
  process.exit(0);
});
process.on('SIGTERM', () => {
   console.error(`[${name}] Received SIGTERM. Shutting down...`);
  process.exit(0);
});