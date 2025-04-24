import type { z } from 'zod';
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
        const schema = tool.inputSchema;
        const isObjectSchema = 'shape' in schema; // Check if it has a .shape property, safer than instanceof z.ZodObject
        // Wrap primitive schema in { value: schema } to conform to ZodRawShape
        const schemaDefinition = isObjectSchema ? (schema as z.ZodObject<z.ZodRawShape>).shape : { value: schema };
        server.tool(
            tool.name,
            tool.description,
            schemaDefinition,
            async (args: Record<string, unknown>) => {
                try {
                    // If the original schema was primitive, extract the value from args.value, otherwise pass the whole args object
                    const executionArgs = isObjectSchema ? args : args.value;
                    const content = await execute(executionArgs, options);
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
    await server.connect(transport);
    return server;
}