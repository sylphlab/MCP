// Remove unused imports: RequestHandlerExtra, ServerRequest, ServerNotification
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z, type ZodObject, type ZodRawShape, type ZodTypeAny } from 'zod';
import {
  type ToolDefinition,
  type ToolExecuteOptions,
  type Part,
  mapWhen,
  BaseContextSchema,
} from '@sylphlab/tools-core';

// Define a more specific type for the tools array in McpServerOptions
export type McpToolDefinition = ToolDefinition<any, any>;

export interface McpServerOptions {
  name: string;
  version: string;
  description: string;
  tools: McpToolDefinition[];
}

// Define the expected MCP content type structure
type McpContent =
  | { type: 'text'; text: string } // Use 'text' property instead of 'data'
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'audio'; data: string; mimeType: string };
  // Add other MCP content types if needed, e.g., resource

// Function to map Sylph Lab Part types to MCP content types
function mapToMcpContent(parts: Part[]): McpContent[] {
  // Use mapWhen and filter out undefined results
  return mapWhen(parts, {
    text: (part) => ({ type: 'text' as const, text: part.value }), // Use 'text' property
    json: (part) => ({ type: 'text' as const, text: JSON.stringify(part.value, null, 2) }), // Stringify JSON for MCP text
    image: (part) => ({ type: 'image' as const, data: part.data, mimeType: part.mimeType }), // Pass mimeType
    audio: (part) => ({ type: 'audio' as const, data: part.data, mimeType: part.mimeType }), // Pass mimeType
    fileRef: (part) => ({ type: 'text' as const, text: `File reference: ${part.path}` }), // Represent fileRef as text
  });
}

// Updated registerTools function to accept ToolDefinition array
export function registerTools(
  server: McpServer,
  tools: McpToolDefinition[],
  toolOptions: ToolExecuteOptions,
): void {
  for (const tool of tools) { // Use for...of loop as suggested by biome
    const { name, description, inputSchema, execute } = tool;

    // Wrap primitive schema in { value: schema } for MCP registration
    const isObjectSchema = 'shape' in inputSchema;
    const schemaDefinition = isObjectSchema
      ? (inputSchema as ZodObject<ZodRawShape>).shape
      : { value: inputSchema };

    // Define the callback without the _extra parameter
    const toolCallback = async (
        mcpArgs: any // Use 'any' for now, or a more specific type if available from SDK
    ): Promise<{ content: McpContent[]; isError?: boolean }> => { // Match expected return type
      try {
        const executionArgs = isObjectSchema ? mcpArgs : mcpArgs.value;
        const executionContext = toolOptions;
        const resultParts = await execute({ context: executionContext, args: executionArgs });
        const mcpContent = mapToMcpContent(resultParts);
        return { content: mcpContent, isError: false };
      } catch (error: unknown) {
        console.error(`Error executing tool ${name}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Ensure error content matches McpContent type
        return { content: [{ type: 'text', text: `Error: ${errorMessage}` }], isError: true }; // Use 'text' property
      }
    };

    server.tool(name, description, schemaDefinition, toolCallback);
  }
}

// Updated startMcpServer function
export async function startMcpServer(
  serverOptions: McpServerOptions,
  toolOptions: ToolExecuteOptions,
): Promise<McpServer> {
  // Dynamically import McpServer only when starting
  const { McpServer: McpServerConstructor } = await import('@modelcontextprotocol/sdk/server/mcp.js');

  const server = new McpServerConstructor({
    name: serverOptions.name,
    version: serverOptions.version,
    description: serverOptions.description,
  });

  registerTools(server, serverOptions.tools, toolOptions);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${serverOptions.name}] MCP server started on stdio.`); // Log to stderr

  // Graceful shutdown handling within startMcpServer
  const shutdown = async (signal: string) => {
    console.error(`[${serverOptions.name}] Received ${signal}. Shutting down...`);
    // Add any specific cleanup logic here if needed
    // await server.disconnect(); // disconnect() method does not exist on McpServer
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}