import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BaseMcpToolOutput, McpTool, McpToolExecuteOptions } from '@sylphlab/mcp-core';
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
  ToolsArray extends ReadonlyArray<McpTool<any, any>> // Constrain the array type
>(server: McpServer, tools: ToolsArray) { // Use the generic array type
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
      const handler = async (args: unknown): Promise<BaseMcpToolOutput> => {
        const workspaceRoot = process.cwd(); // Assuming workspace root is cwd for now
        let result: BaseMcpToolOutput;

        try {
          // Validate args using the tool's full Zod schema
          // Note: defineTool wrapper already handles this if tools are defined using it.
          // This validation might be redundant if defineTool is always used.
          const validatedArgs = tool.inputSchema.parse(args);

          // Call the tool's execute function (which might be wrapped by defineTool)
          // IMPORTANT: We need to pass McpToolExecuteOptions here.
          // Currently, the handler only receives 'args'. The SDK or server framework
          // needs to be adapted to pass options (like maxOutputChars) to this handler.
          // For now, we pass a basic options object.
          const executeOptions: McpToolExecuteOptions = {
             workspaceRoot,
             // maxOutputChars: ??? // Cannot get this from current handler signature
            };
          result = await tool.execute(validatedArgs, executeOptions);

          // Note: Output size check is now handled within defineTool's wrapper,
          // so no need to repeat it here if defineTool is used.

        } catch (execError: unknown) {
          // Format error consistent with BaseMcpToolOutput structure
          const errorMessage =
            execError instanceof Error ? execError.message : 'Unknown execution error';
          result = {
            success: false,
            error: `Tool execution failed: ${errorMessage}`,
            content: [{ type: 'text', text: `Tool execution failed: ${errorMessage}` }],
          };
        }
        // Return the result object
        return result;
      };

      // Register with the SDK server instance
      server.tool(
        tool.name,
        tool.description || '',
        zodShape,
        handler,
      );
    } else {
      // biome-ignore lint/suspicious/noConsole: Intentional warning for skipped tool registration
      console.warn(
        `Tool registration skipped for tool named '${tool?.name || 'unknown'}': Invalid structure or non-object input schema.`
      );
      // Handle or log invalid tool structure if necessary
    }
  }
}