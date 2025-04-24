import { z } from 'zod';
import { mapWhen, type Tool as SylphTool, type ToolExecuteOptions } from '@sylphlab/tools-core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';


export type McpServerOptions = {
    name: string;
    version: string;
    description: string;
    tools: SylphTool[]; // Use the updated type for tools
}

export function registerTools(server: McpServer, tools: SylphTool<z.ZodTypeAny>[], options: ToolExecuteOptions) {
    for (const tool of tools) {
        const { execute } = tool;
        server.tool(
            tool.name,
            tool.description,
            tool.inputSchema instanceof z.ZodObject ? tool.inputSchema.shape : tool.inputSchema, // Cast to ZodRawShape
            async (args: Record<string, unknown>) => {
                try {
                    const content = await execute(args, options);
                    const newContent = mapWhen(content, {
                        text: (part) => ({
                            type: 'text' as const,
                            text: part.value,
                        }),
                        json: (part) => ({
                            type: 'text' as const,
                            text: JSON.stringify(part.value, null, 2),
                        }),
                        image: (part) => part,
                        audio: (part) => part,
                        fileRef: (part) => ({
                            type: 'text' as const,
                            text: `File reference: ${part.path}`,
                        }),
                    });
                    return {
                        content: newContent,
                        isError: false,
                    } as CallToolResult;
                } catch (error) {
                    const errorMessage = error instanceof Error
                        ? error.message
                        : String(error);
                    
                    return {
                        content: [{
                            type: 'text' as const,
                            text: `Error: ${errorMessage}`,
                        }],
                        isError: true,
                    };
                }
            }
        );
    }
}

export async function startMcpServer(options: McpServerOptions, toolOptions: ToolExecuteOptions): Promise<McpServer> {
        
    const server = new McpServer({
        name: options.name,
        version: options.version,
        description: options.description,
    });
    
    registerTools(server, options.tools, toolOptions); // Register tools with the server
        
    const transport = new StdioServerTransport();
    await server.server.connect(transport);
    return server;
}