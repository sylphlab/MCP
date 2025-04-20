import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';
import os from 'node:os';

// --- Zod Schemas ---

// Input schema - no parameters needed for this specific tool
export const GetInterfacesToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
});

// --- TypeScript Types ---
export type GetInterfacesToolInput = z.infer<typeof GetInterfacesToolInputSchema>;

// Define a more specific type for the result if possible, based on os.networkInterfaces()
// This is complex, so using 'any' for now, but could be refined.
type NetworkInterfaces = { [key: string]: os.NetworkInterfaceInfo[] | undefined };

// Output interface
export interface GetInterfacesToolOutput extends BaseMcpToolOutput {
  id?: string;
  result?: NetworkInterfaces; // Result is the network interfaces object
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---
export const getInterfacesTool: McpTool<typeof GetInterfacesToolInputSchema, GetInterfacesToolOutput> = {
  name: 'getInterfaces',
  description: 'Retrieves details about the network interfaces on the machine.',
  inputSchema: GetInterfacesToolInputSchema,

  async execute(input: GetInterfacesToolInput, options: McpToolExecuteOptions): Promise<GetInterfacesToolOutput> { // Use options object
    const { id } = input;
    // workspaceRoot is now in options.workspaceRoot if needed

    try {
      console.log(`Getting network interfaces... (ID: ${id ?? 'N/A'})`);
      const interfaces = os.networkInterfaces();
      console.log(`Network interfaces retrieved. (ID: ${id ?? 'N/A'})`);

      const contentText = JSON.stringify({
          success: true,
          id: id,
          result: interfaces,
          suggestion: 'Result contains local network interface details.'
      }, null, 2);
      return {
        success: true,
        id: id,
        result: interfaces, // Keep original field
        content: [{ type: 'text', text: contentText }], // Put JSON in content
        suggestion: 'Result contains local network interface details.', // Keep original field
      };
    } catch (e: any) {
      // Errors are less likely here unless os module has issues
      const errorMsg = `Failed to get network interfaces: ${e.message}`;
      console.error(errorMsg);
      const suggestion = 'Check system permissions or Node.js environment.';
      const errorContentText = JSON.stringify({
          success: false,
          id: id,
          error: errorMsg,
          suggestion: suggestion
      }, null, 2);
      return {
        success: false,
        id: id,
        error: errorMsg, // Keep original field
        suggestion: suggestion, // Keep original field
        content: [{ type: 'text', text: errorContentText }], // Put JSON in content
      };
    }
  },
};

console.log('MCP Get Network Interfaces Tool Loaded');