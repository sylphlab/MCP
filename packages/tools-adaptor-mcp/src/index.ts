import type { z } from 'zod';
// Import ToolDefinition and rename it
import { mapWhen, type ToolDefinition as SylphToolDefinition, type ToolExecuteOptions, type BaseContextSchema } from '@sylphlab/tools-core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';


export type McpServerOptions = {
    name: string;
    version: string;
    description: string;
    tools: SylphToolDefinition[]; // Use the updated type for tools
}

// Update function signature to use ToolDefinition
export function registerTools(server: McpServer, tools: SylphToolDefinition<z.ZodTypeAny, typeof BaseContextSchema>[], options: ToolExecuteOptions) {
    for (const tool of tools) {
        const { execute, contextSchema, inputSchema } = tool; // Destructure contextSchema and inputSchema
        const isObjectSchema = 'shape' in inputSchema; // Check inputSchema
        // Wrap primitive schema in { value: schema } to conform to ZodRawShape
        const inputSchemaDefinition = isObjectSchema ? (inputSchema as z.ZodObject<z.ZodRawShape>).shape : { value: inputSchema };
        // TODO: Use contextSchema for validation/transformation if needed in the future
        server.tool(
            tool.name,
            tool.description,
            inputSchemaDefinition, // Use the potentially wrapped input schema definition
            async (args: Record<string, unknown>) => {
                try {
                    // If the original input schema was primitive, extract the value from args.value
                    const executionArgs = isObjectSchema ? args : args.value;
                    // Prepare the context object based on the tool's contextSchema
                    // For now, we pass the base options. A more robust solution might involve
                    // validating/transforming options based on contextSchema here.
                    const executionContext = options; // Pass base options as context for now

                    // Call execute with the new signature { context, args }
                    const content = await execute({ context: executionContext, args: executionArgs });
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