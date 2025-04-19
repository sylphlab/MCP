import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';
import os from 'node:os'; // For networkInterfaces

// --- Zod Schemas ---

export const NetOperationEnum = z.enum(['getPublicIp', 'getInterfaces']);

// Input schema for a SINGLE network operation
// Use discriminated union if operations have different parameters later
export const NetToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
  operation: NetOperationEnum,
  // Add operation-specific parameters here if needed
});

// --- TypeScript Types ---
export type NetOperation = z.infer<typeof NetOperationEnum>;
export type NetToolInput = z.infer<typeof NetToolInputSchema>;

// Output interface for a SINGLE network result
export interface NetToolOutput extends BaseMcpToolOutput {
  // BaseMcpToolOutput provides 'success' and 'content'
  id?: string; // Corresponds to input id if provided
  result?: any; // Operation-specific result
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---

// Helper to fetch public IP (can be called directly by execute)
// Consider adding caching within this helper if called frequently by the server wrapper
async function fetchPublicIp(): Promise<{ ip: string | null; error: string | null }> {
  console.log('Fetching public IP...');
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log('Public IP fetched.');
    return { ip: data.ip, error: null };
  } catch (e: any) {
    const errorMsg = `Failed to fetch public IP: ${e.message}`;
    console.error(errorMsg);
    return { ip: null, error: errorMsg };
  }
}

export const netTool: McpTool<typeof NetToolInputSchema, NetToolOutput> = {
  name: 'net',
  description: 'Performs a network operation (get public IP or list interfaces).',
  inputSchema: NetToolInputSchema, // Schema for single item

  async execute(input: NetToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<NetToolOutput> {
    // Logic now directly processes the single 'input' object.
    const { id, operation } = input;

    try {
      let operationResult: any;
      let suggestion: string | undefined;

      switch (operation) {
        case 'getPublicIp': {
          const publicIpInfo = await fetchPublicIp(); // Fetch directly
          if (publicIpInfo.error) {
            throw new Error(publicIpInfo.error);
          }
          if (publicIpInfo.ip) {
            operationResult = publicIpInfo.ip;
          } else {
             throw new Error('Public IP could not be determined.');
          }
          suggestion = 'Check internet connection if errors persist.';
          break;
        }
        case 'getInterfaces': {
          console.log(`Getting network interfaces... (ID: ${id ?? 'N/A'})`);
          operationResult = os.networkInterfaces();
          console.log(`Network interfaces retrieved. (ID: ${id ?? 'N/A'})`);
          suggestion = 'Result contains local network interface details.';
          break;
        }
      }

      return {
        success: true,
        id: id,
        result: operationResult,
        content: [{ type: 'text', text: `Network operation '${operation}' successful.` }],
        suggestion: suggestion, // Provide context suggestion
      };

    } catch (e: any) {
      const errorMsg = `Network operation '${operation}' failed: ${e.message}`;
      console.error(errorMsg);
      return {
        success: false,
        id: id,
        error: errorMsg,
        suggestion: `Check operation parameters or system network state. For public IP, check internet connection.`,
        content: [],
      };
    }
  },
};

console.log('MCP Net Tool (Single Operation) Loaded');