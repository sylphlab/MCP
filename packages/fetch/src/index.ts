#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZodObject, ZodRawShape, z } from 'zod'; // Import z
import { McpTool } from '@sylphlab/mcp-core';

// Import the tool object from the core library
import { fetchTool } from '@sylphlab/mcp-fetch-core';

// --- Server Setup ---

const serverName = 'fetch';
const serverDescription = 'Provides a tool to perform HTTP fetch requests.';
const serverVersion = '0.1.0'; // TODO: Update version as needed

// Instantiate McpServer
const mcpServer = new McpServer(
  {
    name: serverName,
    version: serverVersion,
    description: serverDescription,
  },
  {}, // No options needed here
);

// Array of imported tool objects (only one for this package)
const definedTools: McpTool<any, any>[] = [
    fetchTool,
];

// Register tools using the mcpServer.tool() method
definedTools.forEach((tool) => {
  if (tool && tool.name && tool.execute && tool.inputSchema instanceof ZodObject) {
    const zodShape: ZodRawShape = tool.inputSchema.shape;
    mcpServer.tool(
      tool.name,
      tool.description || '',
      zodShape, // Pass the .shape property for SDK validation
      async (args: unknown) => { // Simple wrapper
          const workspaceRoot = process.cwd(); // workspaceRoot might not be directly relevant for fetch
          try {
              // Parse args with the original Zod schema
              const validatedArgs = tool.inputSchema.parse(args);
              // Call original execute with validated args
              const result = await tool.execute(validatedArgs, workspaceRoot);
              // Ensure content array exists if success is true
              if (result.success && !result.content) {
                  result.content = [];
              }
              return result;
          } catch (execError: any) {
               console.error(`Error during execution of ${tool.name}:`, execError);
               // Return a standard error format
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
      console.error(`Fetch MCP Server "${serverName}" v${serverVersion} started successfully via stdio.`);
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
