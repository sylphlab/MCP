import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpTool } from '@sylphlab/mcp-core'; // Only need McpTool type now

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

// --- Server Setup using SDK ---

const serverName = 'filesystem';
const serverDescription = 'Provides tools for interacting with the local filesystem.';
const serverVersion = '0.1.1'; // Match package.json version

// Array of tool objects (before schema conversion)
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

// Create the transport (stdio)
const transport = new StdioServerTransport();

// Create the MCP Server instance using the SDK, passing tools in constructor
const server = new McpServer({
    transport,
    name: serverName, // Correct property name
    description: serverDescription,
    version: serverVersion,
    // Pass tools, converting schemas and wrapping execute
    tools: definedTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema, { $refStrategy: 'none' }),
        execute: async (args: unknown) => {
            // SDK handles validation based on the JSON schema
            const workspaceRoot = process.cwd(); // TODO: Improve workspace root detection
            // The actual tool.execute expects validated input matching its Zod schema.
            // We rely on the SDK having validated args against the JSON schema derived from Zod.
            // A direct cast 'args as any' is pragmatic here, assuming SDK validation is sufficient.
            // For stricter typing, one might parse args again with tool.inputSchema, but that's redundant.
            return tool.execute(args as any, workspaceRoot);
        },
    })),
    // Optional: Define resources here if needed
    // resources: [...]
});

// Logging registration happens internally in the SDK or can be added if needed
console.error(`MCP Server "${serverName}" v${serverVersion} initialized with ${definedTools.length} tools.`);
console.error('Transport will start listening automatically...');

// SDK handles start/stop via transport lifecycle.

// Handle graceful shutdown (Transport might handle this, but keep for safety)
process.on('SIGINT', () => {
    console.error('Received SIGINT. Attempting graceful shutdown...');
    // Check SDK documentation for specific shutdown methods if needed
    // transport.close(); // Example
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.error('Received SIGTERM. Attempting graceful shutdown...');
    // transport.close(); // Example
    process.exit(0);
});

// Keep the process alive indefinitely
setInterval(() => {}, 1 << 30); // Use a large interval (approx. 12 days)