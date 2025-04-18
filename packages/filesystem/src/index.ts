#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZodObject, ZodRawShape } from 'zod'; // Import necessary Zod types
import { McpTool } from '@sylphlab/mcp-core'; // Import base McpTool type

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
  {
    // Capabilities will be registered via mcpServer.tool()
  },
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

// Register tools using the mcpServer.tool() method
definedTools.forEach((tool) => {
  // Assume all tools have name, execute, and inputSchema (which is a ZodObject)
  if (tool && tool.name && tool.execute && tool.inputSchema instanceof ZodObject) {
    const zodShape: ZodRawShape = tool.inputSchema.shape;
    mcpServer.tool(
      tool.name,
      tool.description || '',
      zodShape, // Pass the .shape property
      async (args: unknown) => { // Wrap the original execute
          const workspaceRoot = process.cwd(); // TODO: Improve workspace root detection
          try {
              // SDK validates against the shape, execute expects validated args
              const result = await tool.execute(args as any, workspaceRoot);
              return result;
          } catch (execError: any) {
               console.error(`Error during execution of ${tool.name}:`, execError);
               return {
                   success: false,
                   error: `Tool execution failed: ${execError.message || 'Unknown error'}`,
                   content: [{ type: 'text', text: `Tool execution failed: ${execError.message || 'Unknown error'}` }]
               };
          }
      }
    );
    console.error(`Registered tool: ${tool.name}`);
  } else {
    console.warn('Skipping invalid tool definition during registration:', tool);
  }
});


// --- Server Start ---
try {
  const transport = new StdioServerTransport();
  // Connect the underlying server instance from McpServer
  // Use mcpServer.server which holds the actual rpc-server instance
  await mcpServer.server.connect(transport);
  console.error(`Filesystem MCP Server "${serverName}" v${serverVersion} started successfully via stdio.`);
  console.error('Waiting for requests...');
} catch (error: unknown) {
  console.error('Server failed to start:', error);
  process.exit(1);
}