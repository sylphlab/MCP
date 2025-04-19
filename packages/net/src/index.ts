#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZodObject, ZodRawShape, z } from 'zod';
import { McpTool } from '@sylphlab/mcp-core';

// Import the tool object from the core library
import { netTool } from '@sylphlab/mcp-net-core';

// --- Server Setup ---

const serverName = 'net';
const serverDescription = 'Provides tools for network operations (get public IP, list interfaces).';
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
    netTool,
];

// Register tools
definedTools.forEach((tool) => {
  if (tool && tool.name && tool.execute && tool.inputSchema instanceof ZodObject) {
    const zodShape: ZodRawShape = tool.inputSchema.shape;
    mcpServer.tool(
      tool.name,
      tool.description || '',
      zodShape,
      async (args: unknown) => {
          const workspaceRoot = process.cwd();
          try {
              const validatedArgs = tool.inputSchema.parse(args);
              const result = await tool.execute(validatedArgs, workspaceRoot);
              if (result.success && !result.content) {
                  result.content = [];
              }
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
