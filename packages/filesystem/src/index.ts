import { z } from 'zod';
import readline from 'readline';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core'; // Import only base types

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

// --- Server Logic (Moved from mcp-core) ---

// defineMcpTool helper removed - construct object directly

interface McpServerOptions {
    name: string;
    description: string;
    version: string;
}

interface McpServer {
    registerTool: <TInputSchema extends z.ZodTypeAny, TOutput extends BaseMcpToolOutput>(
        tool: McpTool<TInputSchema, TOutput>
    ) => void;
    start: () => Promise<void>;
}

/**
 * Creates a basic MCP server instance that communicates over stdio.
 */
function createMcpServer(options: McpServerOptions): McpServer {
    const tools: Map<string, McpTool<any, any>> = new Map();

    const registerTool = <TInputSchema extends z.ZodTypeAny, TOutput extends BaseMcpToolOutput>(
        tool: McpTool<TInputSchema, TOutput>
    ) => {
        if (tools.has(tool.name)) {
            console.warn(`Warning: Tool "${tool.name}" is already registered. Overwriting.`);
        }
        tools.set(tool.name, tool);
        console.log(`Registered tool: ${tool.name}`);
    };

    const start = async (): Promise<void> => {
        console.log(`Starting MCP Server: ${options.name} v${options.version}`);
        console.log(options.description);
        console.log('Waiting for requests on stdin...');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });

        rl.on('line', async (line) => {
            try {
                const request = JSON.parse(line);
                if (request.type !== 'tool_call' || !request.tool_name || !request.arguments) {
                    throw new Error('Invalid request format.');
                }

                const tool = tools.get(request.tool_name);
                if (!tool) {
                    throw new Error(`Tool "${request.tool_name}" not found.`);
                }

                const parsedInput = tool.inputSchema.safeParse(request.arguments);
                if (!parsedInput.success) {
                    throw new Error(`Input validation failed for tool "${request.tool_name}": ${parsedInput.error.message}`);
                }

                // TODO: Determine workspaceRoot properly - using process.cwd() for now
                const workspaceRoot = process.cwd();
                const result = await tool.execute(parsedInput.data, workspaceRoot);

                process.stdout.write(JSON.stringify({ type: 'tool_result', result }) + '\n');

            } catch (error: any) {
                process.stdout.write(JSON.stringify({
                    type: 'tool_result',
                    result: {
                        success: false,
                        error: error.message || 'An unknown error occurred.',
                        content: [{ type: 'text', text: `Error: ${error.message || 'Unknown error'}` }]
                    }
                }) + '\n');
            }
        });

        rl.on('close', () => {
            console.log('Stdin closed. Exiting server.');
            process.exit(0);
        });
    };

    return {
        registerTool,
        start,
    };
}

// --- Server Setup & Tool Registration ---

const server = createMcpServer({
  name: 'filesystem',
  description: 'Provides tools for interacting with the local filesystem.',
  version: '0.1.0', // Match package.json
});

// Define and register tools using imported implementations and schemas
// Pass the imported McpTool objects directly
server.registerTool(copyItemsTool);
server.registerTool(createFolderTool);
server.registerTool(deleteItemsTool);
server.registerTool(editFileTool);
server.registerTool(listFilesTool);
server.registerTool(moveRenameItemsTool);
server.registerTool(readFilesTool);
server.registerTool(replaceContentTool);
server.registerTool(searchContentTool);
server.registerTool(statItemsTool);
server.registerTool(writeFilesTool);

// Start the server
server.start().catch((error) => {
  console.error('Failed to start filesystem server:', error);
  process.exit(1);
});

console.log('Filesystem MCP server started.');