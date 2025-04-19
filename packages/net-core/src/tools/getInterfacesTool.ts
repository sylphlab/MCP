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

  async execute(input: GetInterfacesToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<GetInterfacesToolOutput> {
    const { id } = input;

    try {
      console.log(`Getting network interfaces... (ID: ${id ?? 'N/A'})`);
      const interfaces = os.networkInterfaces();
      console.log(`Network interfaces retrieved. (ID: ${id ?? 'N/A'})`);

      return {
        success: true,
        id: id,
        result: interfaces,
        // Content could summarize, e.g., list interface names
        content: [{ type: 'text', text: `Retrieved details for interfaces: ${Object.keys(interfaces).join(', ')}` }],
        suggestion: 'Result contains local network interface details.',
      };
    } catch (e: any) {
      // Errors are less likely here unless os module has issues
      const errorMsg = `Failed to get network interfaces: ${e.message}`;
      console.error(errorMsg);
      return {
        success: false,
        id: id,
        error: errorMsg,
        suggestion: 'Check system permissions or Node.js environment.',
        content: [],
      };
    }
  },
};

console.log('MCP Get Network Interfaces Tool Loaded');