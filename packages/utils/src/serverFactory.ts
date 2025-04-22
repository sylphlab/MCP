import { McpServer /*, type McpServerOptions */ } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'; // Import StdioTransport
import type { McpTool } from '@sylphlab/mcp-core';
import type { z } from 'zod'; // Keep z import if needed
import { registerTools } from './registerTools.js'; // Import the extracted function

// Use McpTool<any, any>[] for the tools array type to accept diverse signatures.
// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
// Removed unused suppression comment that was here
type ServerOptions = {
  name: string;
  version: string;
  description: string;
  tools: McpTool<any, any>[]; // Use <any, any> here
  // Add other metadata fields as needed
};

/**
 * Creates, configures, registers tools, and starts an McpServer instance using StdioTransport.
 * This factory aims to reduce boilerplate code in individual MCP server packages.
 *
 * @param tools An array of McpTool objects (ideally created using defineTool from @sylphlab/mcp-core).
 * @param mcpServerMetadata Metadata for the McpServer constructor (name, version, description).
 * @returns A promise that resolves when the server is connected, or rejects on error.
 */
// Function signature no longer needs generics
export async function startMcpServer(
  options: ServerOptions, // Use the updated ServerOptions type
): Promise<void> {
  // Returns Promise<void>
  const { name, description, version, tools } = options; // Destructure options
  // Create the server instance using metadata provided
  const server = new McpServer(
    {
      name,
      version,
      description,
    },
    {},
  ); // Empty object for options, can be expanded later

  // Register tools using the external function
  registerTools(server, tools);

  // Optional: Add standard logging or lifecycle hooks here if desired
  const _toolNames = tools.map((t) => t.name).join(', ');
  const _serverName = name ?? 'Unnamed'; // Use name from options
  // Consider adding more sophisticated logging based on mcpServerMetadata or other config

  // Start the server directly within this function
  try {
    // Directly use StdioServerTransport
    const transport = new StdioServerTransport();
    // Connect the server using the stdio transport
    await server.server.connect(transport);
    // Keep running until process termination signal
  } catch (_error: unknown) {
    // Exit the process directly if connection fails
    process.exit(1);
    // throw error; // No longer re-throwing
  }
  // No explicit return needed for Promise<void> on success path
}
