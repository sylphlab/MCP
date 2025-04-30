#!/usr/bin/env node
import process from 'node:process';
import { startMcpServer } from '@sylphlab/tools-adaptor-mcp';
import type { ToolDefinition, ToolExecuteOptions } from '@sylphlab/tools-core';
import { description, name, version } from '../package.json';

// Import NEW and adapted tools from the core memory package
import {
  // Adapted CRUD
  createNodesTool,
  createEdgesTool,
  deleteNodesTool,
  deleteEdgesTool,
  // New Query
  getNodeTool,
  findNodesTool,
  listNodesTool,
  listLabelsTool,
  listRelationTypesTool,
  findRelatedNodesTool,
  // New Update
  updateNodePropertiesTool,
  replaceNodePropertiesTool,
  addNodeLabelsTool,
  removeNodeLabelsTool,
  updateEdgePropertiesTool,
  replaceEdgePropertiesTool,
  // Removed/Deprecated tools are no longer imported
} from '@sylphlab/tools-memory';

// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
const tools: ToolDefinition<any, any>[] = [
  // Adapted CRUD
  createNodesTool,
  createEdgesTool,
  deleteNodesTool,
  deleteEdgesTool,
  // New Query
  getNodeTool,
  findNodesTool,
  listNodesTool,
  listLabelsTool,
  listRelationTypesTool,
  findRelatedNodesTool,
  // New Update
  updateNodePropertiesTool,
  replaceNodePropertiesTool,
  addNodeLabelsTool,
  removeNodeLabelsTool,
  updateEdgePropertiesTool,
  replaceEdgePropertiesTool,
];

// --- Server Start ---
(async () => {
  // Define the specific options type for memory tools
  // This structure should match MemoryContext defined in @sylphlab/tools-memory/types
  const toolOptions: ToolExecuteOptions & { memoryFilePath?: string } = {
    workspaceRoot: process.cwd(),
    memoryFilePath: process.env.MEMORY_FILE_PATH, // Read env var here
  };

  try {
    await startMcpServer(
      {
        name,
        description,
        version,
        tools, // Pass the updated tools array
      },
      toolOptions,
    );
    console.error(`[${name}] MCP server started successfully on stdio.`);
  } catch (error) {
    console.error(`[${name}] Failed to start MCP server:`, error);
    process.exit(1);
  }
})();

// Graceful shutdown handlers remain the same
process.on('SIGINT', () => {
  console.error(`[${name}] Received SIGINT. Shutting down...`);
  process.exit(0);
});
process.on('SIGTERM', () => {
   console.error(`[${name}] Received SIGTERM. Shutting down...`);
  process.exit(0);
});