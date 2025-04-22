import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpTool, McpToolExecuteOptions } from '@sylphlab/mcp-core';
import { ZodObject, type ZodRawShape, type z } from 'zod';

/**
 * Registers an array of McpTool objects with an McpServer instance.
 * Handles the underlying SDK registration and wraps the tool's execute method
 * with validation and basic error handling.
 *
 * @param server The McpServer instance.
 * @param tools A readonly array of McpTool objects to register.
 */
// Make the function generic over the array type itself
// biome-ignore lint/suspicious/noExplicitAny: Necessary for array of tools with diverse signatures
export function registerTools<
  ToolsArray extends ReadonlyArray<McpTool<any, any>>, // Constrain the array type
>(server: McpServer, tools: ToolsArray) {
  // Use the generic array type
  for (const tool of tools) {
    // Basic validation of the tool object structure
    if (
      tool?.name &&
      typeof tool.name === 'string' &&
      tool.execute &&
      typeof tool.execute === 'function' &&
      tool.inputSchema instanceof ZodObject // Ensure inputSchema is a ZodObject for shape extraction
    ) {
      const zodShape: ZodRawShape = tool.inputSchema.shape;

      // Define the handler that the SDK will call
      const handler = async (args: unknown): Promise<any> => {
        // Use Promise<any>
        const workspaceRoot = process.cwd(); // Define workspaceRoot at the start of handler
        let result: any; // Use any for result type

        try {
          // Added missing opening brace for try block
          // Validate args using the tool's full Zod schema
          // Note: defineTool wrapper should handle this if tools are defined using it.
          const validatedArgs = tool.inputSchema.parse(args);

          // Call the tool's execute function
          const executeOptions: McpToolExecuteOptions = {
            workspaceRoot: workspaceRoot, // Correct assignment
            // maxOutputChars: ??? // Cannot get this from current handler signature
          };
          // Assuming tool.execute now returns Part[] based on defineTool changes
          // The handler needs to adapt or defineTool needs to handle this layer
          // For now, keep as is, but this might need further refactoring depending on SDK interaction
          result = await tool.execute(validatedArgs, executeOptions);
        } catch (execError: unknown) {
          // Format error (consider if defineTool already formats errors)
          const errorMessage =
            execError instanceof Error ? execError.message : 'Unknown execution error';
          // This error structure might be inconsistent with Part[] return type
          result = {
            success: false,
            error: `Tool execution failed: ${errorMessage}`,
            // Returning a simple error structure, might need adjustment based on SDK expectations
            // content: [{ type: 'text', text: `Tool execution failed: ${errorMessage}` }],
          };
        }
        // Return the result object
        return result;
      };

      // Register with the SDK server instance
      server.tool(tool.name, tool.description || '', zodShape, handler);
    } else {
      // biome-ignore lint/suspicious/noConsole: Intentional warning
      console.warn(
        `Tool registration skipped for tool named '${tool?.name || 'unknown'}': Invalid structure or non-object input schema.`,
      );
    }
  }
}
