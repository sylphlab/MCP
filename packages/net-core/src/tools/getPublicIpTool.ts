import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

// Input schema - no parameters needed for this specific tool
export const GetPublicIpToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
});

// --- TypeScript Types ---
export type GetPublicIpToolInput = z.infer<typeof GetPublicIpToolInputSchema>;

// Output interface
export interface GetPublicIpToolOutput extends BaseMcpToolOutput {
  id?: string;
  result?: string; // The public IP address
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---

// Helper to fetch public IP
async function fetchPublicIp(): Promise<{ ip: string | null; error: string | null }> {
  console.log('Fetching public IP...');
  try {
    // Using a different service that might be more reliable or just for variety
    const response = await fetch('https://ipinfo.io/json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (!data.ip) throw new Error('IP address not found in response from ipinfo.io');
    console.log('Public IP fetched.');
    return { ip: data.ip, error: null };
  } catch (e: any) {
    const errorMsg = `Failed to fetch public IP: ${e.message}`;
    console.error(errorMsg);
    // Attempt fallback
    try {
        console.log('Attempting fallback public IP service...');
        const fallbackResponse = await fetch('https://api.ipify.org?format=json');
        if (!fallbackResponse.ok) throw new Error(`Fallback HTTP error! status: ${fallbackResponse.status}`);
        const fallbackData = await fallbackResponse.json();
         if (!fallbackData.ip) throw new Error('IP address not found in fallback response from api.ipify.org');
        console.log('Public IP fetched via fallback.');
        return { ip: fallbackData.ip, error: null };
    } catch (fallbackError: any) {
         const fallbackErrorMsg = `Fallback failed: ${fallbackError.message}`;
         console.error(fallbackErrorMsg);
         // Return the original error message if fallback also fails
         return { ip: null, error: `${errorMsg}. Fallback also failed: ${fallbackErrorMsg}` };
    }
  }
}

export const getPublicIpTool: McpTool<typeof GetPublicIpToolInputSchema, GetPublicIpToolOutput> = {
  name: 'getPublicIp',
  description: 'Retrieves the public IP address of the machine running the MCP server.',
  inputSchema: GetPublicIpToolInputSchema,

  async execute(input: GetPublicIpToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<GetPublicIpToolOutput> {
    const { id } = input;

    try {
      const publicIpInfo = await fetchPublicIp();
      if (publicIpInfo.error) {
        throw new Error(publicIpInfo.error);
      }
      if (publicIpInfo.ip) {
        const contentText = JSON.stringify({
            success: true,
            id: id,
            result: publicIpInfo.ip
        }, null, 2);
        return {
          success: true,
          id: id,
          result: publicIpInfo.ip, // Keep original field
          content: [{ type: 'text', text: contentText }], // Put JSON in content
        };
      } else {
         // Should be caught by the error check above, but as a safeguard
         throw new Error('Public IP could not be determined.');
      }
    } catch (e: any) {
      const errorMsg = `Failed to get public IP: ${e.message}`;
      console.error(errorMsg);
      const suggestion = 'Check internet connection and firewall settings.';
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

console.log('MCP Get Public IP Tool Loaded');