import os from 'node:os';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import { GetInterfacesToolInputSchema } from './getInterfacesTool.schema.js'; // Import schema (added .js)

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

// --- Tool Definition using defineTool ---
export const getInterfacesTool = defineTool({
  name: 'getInterfaces',
  description: 'Retrieves details about the network interfaces on the machine.',
  inputSchema: GetInterfacesToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: GetInterfacesToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<GetInterfacesToolOutput> => { // Still returns the specific output type

    const { id } = input;

    // Removed try/catch, defineTool wrapper handles errors

    const interfaces = os.networkInterfaces();

    // Construct the success output
    const contentText = JSON.stringify(
      {
        success: true,
        id: id,
        result: interfaces,
        suggestion: 'Result contains local network interface details.',
      },
      (_key, value) => { // Handle potential BigInts if any interface info contains them
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      },
      2,
    );
    return {
      success: true,
      id: id,
      result: interfaces, // Keep original field
      content: [{ type: 'text', text: contentText }], // Put JSON in content
      suggestion: 'Result contains local network interface details.', // Keep original field
    };
    // Errors during os.networkInterfaces() are unlikely but will be caught by defineTool
  },
});

// Ensure necessary types are still exported
// export type { GetInterfacesToolInput, GetInterfacesToolOutput, NetworkInterfaces }; // Removed duplicate export
