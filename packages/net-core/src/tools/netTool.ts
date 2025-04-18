import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';
import os from 'node:os'; // For networkInterfaces

// --- Zod Schemas ---

const NetOperationEnum = z.enum(['getPublicIp', 'getInterfaces']);

// Schema for a single network operation item
// Use discriminated union if operations have different parameters later
const NetInputItemSchema = z.object({
  id: z.string().optional(),
  operation: NetOperationEnum,
  // Add operation-specific parameters here if needed
});

// Main input schema: an array of network items
export const NetToolInputSchema = z.object({
  items: z.array(NetInputItemSchema).min(1, 'At least one network operation item is required.'),
});

// --- TypeScript Types ---
export type NetOperation = z.infer<typeof NetOperationEnum>;
export type NetInputItem = z.infer<typeof NetInputItemSchema>;
export type NetToolInput = z.infer<typeof NetToolInputSchema>;

// Interface for a single network result item
export interface NetResultItem {
  id?: string;
  success: boolean;
  result?: any; // Operation-specific result
  error?: string;
  suggestion?: string;
}

// Output interface for the tool
export interface NetToolOutput extends BaseMcpToolOutput {
  results: NetResultItem[];
  error?: string; // Optional overall error
}

// --- Tool Definition ---

// Helper to fetch public IP once
let publicIpCache: { ip: string | null; error: string | null; timestamp: number | null } = {
  ip: null,
  error: null,
  timestamp: null,
};
const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache for 5 minutes

async function getCachedPublicIp(): Promise<{ ip: string | null; error: string | null }> {
  const now = Date.now();
  if (publicIpCache.timestamp && (now - publicIpCache.timestamp < CACHE_DURATION_MS)) {
    console.log('Using cached public IP info.');
    return { ip: publicIpCache.ip, error: publicIpCache.error };
  }

  console.log('Fetching public IP...');
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    publicIpCache = { ip: data.ip, error: null, timestamp: now };
    console.log('Public IP fetched and cached.');
    return { ip: data.ip, error: null };
  } catch (e: any) {
    const errorMsg = `Failed to fetch public IP: ${e.message}`;
    console.error(errorMsg);
    publicIpCache = { ip: null, error: errorMsg, timestamp: now }; // Cache the error too
    return { ip: null, error: errorMsg };
  }
}

// Re-implement the core logic within the execute method
async function processSingleNet(item: NetInputItem, publicIpInfo: { ip: string | null; error: string | null }): Promise<NetResultItem> {
  const { id, operation } = item;
  const resultItem: NetResultItem = { id, success: false };

  try {
    switch (operation) {
      case 'getPublicIp':
        if (publicIpInfo.error) {
          throw new Error(publicIpInfo.error);
        }
        if (publicIpInfo.ip) {
          resultItem.result = publicIpInfo.ip;
          resultItem.success = true;
        } else {
           throw new Error('Public IP was not fetched successfully.');
        }
        break;

      case 'getInterfaces':
        console.log(`Getting network interfaces... (ID: ${id ?? 'N/A'})`);
        resultItem.result = os.networkInterfaces();
        resultItem.success = true;
        console.log(`Network interfaces retrieved. (ID: ${id ?? 'N/A'})`);
        break;

      // No default needed due to Zod validation
    }
  } catch (e: any) {
    resultItem.error = `Operation '${operation}' failed: ${e.message}`;
    resultItem.suggestion = `Check operation parameters or system network state. For public IP, check internet connection.`;
     if (operation === 'getPublicIp' && !publicIpInfo.error) {
         resultItem.suggestion += ' The public IP might not have been requested or fetched successfully earlier.';
      }
    console.error(resultItem.error);
  }
  return resultItem;
}


export const netTool: McpTool<typeof NetToolInputSchema, NetToolOutput> = {
  name: 'net',
  description: 'Performs network operations like getting public IP or listing network interfaces.',
  inputSchema: NetToolInputSchema,

  async execute(input: NetToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<NetToolOutput> {
    const { items } = input; // Input is validated by the server
    const results: NetResultItem[] = [];
    let overallSuccess = true;

    // Fetch public IP once if needed by any item
    const needsPublicIp = items.some((item: NetInputItem) => item.operation === 'getPublicIp');
    let publicIpInfo: { ip: string | null; error: string | null } = { ip: null, error: null };
    if (needsPublicIp) {
        publicIpInfo = await getCachedPublicIp();
    }

    try {
      // Process sequentially
      for (const item of items) {
        const result = await Promise.resolve(processSingleNet(item, publicIpInfo));
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
        }
      }

      return {
        success: overallSuccess,
        results: results,
        content: [{ type: 'text', text: `Processed ${items.length} network operations. Overall success: ${overallSuccess}` }],
      };
    } catch (e: any) {
      console.error(`Unexpected error during net tool execution: ${e.message}`);
      return {
        success: false,
        results: results,
        error: `Unexpected tool error: ${e.message}`,
        content: [],
      };
    }
  },
};

console.log('MCP Net Tool Loaded');