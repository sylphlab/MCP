import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type BaseMcpToolOutput, McpContentPart, type McpTool } from '@sylphlab/mcp-core';
import { ZodObject, type ZodRawShape } from 'zod';

/**
 * Registers an array of McpTool objects with an McpServer instance.
 *
 * @param server The McpServer instance.
 * @param tools An array of McpTool objects to register.
 */
// biome-ignore lint/suspicious/noExplicitAny: Function handles diverse tools; types checked internally
export function registerTools(server: McpServer, tools: McpTool<any, any>[]) {
  for (const tool of tools) {
    // Basic validation of the tool object structure
    if (
      tool?.name &&
      typeof tool.name === 'string' &&
      tool.execute &&
      typeof tool.execute === 'function' &&
      tool.inputSchema instanceof ZodObject
    ) {
      const zodShape: ZodRawShape = tool.inputSchema.shape;

      // Use simpler handler signature, return Promise<any> to bypass strict SDK type check for now
      const handler = async (args: unknown): Promise<BaseMcpToolOutput> => {
        // Return BaseMcpToolOutput
        const workspaceRoot = process.cwd();
        let result: BaseMcpToolOutput; // Use BaseMcpToolOutput internally

        try {
          // Validate args using the tool's full Zod schema
          const validatedArgs = tool.inputSchema.parse(args);

          // Call the original tool's execute function, passing workspaceRoot in options
          const executeOptions = { workspaceRoot }; // Pass workspaceRoot in options
          result = await tool.execute(validatedArgs, executeOptions); // Pass only input and options
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
        // Return the result object - relies on BaseMcpToolOutput being structurally compatible
        return result;
      };

      server.tool(
        tool.name,
        tool.description || '',
        zodShape,
        handler, // Pass the handler
      );
    } else {
      // Handle or log invalid tool structure if necessary
    }
  } // End for...of loop
}
