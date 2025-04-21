import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import { GetPublicIpToolInputSchema } from './getPublicIpTool.schema.js'; // Import schema (added .js)

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
  try {
    // Using a different service that might be more reliable or just for variety
    const response = await fetch('https://ipinfo.io/json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (!data.ip) throw new Error('IP address not found in response from ipinfo.io');
    return { ip: data.ip, error: null };
  } catch (e: unknown) {
    const errorMsg = `Failed to fetch public IP: ${e instanceof Error ? e.message : String(e)}`;
    // Attempt fallback
    try {
      const fallbackResponse = await fetch('https://api.ipify.org?format=json');
      if (!fallbackResponse.ok)
        throw new Error(`Fallback HTTP error! status: ${fallbackResponse.status}`);
      const fallbackData = await fallbackResponse.json();
      if (!fallbackData.ip)
        throw new Error('IP address not found in fallback response from api.ipify.org');
      return { ip: fallbackData.ip, error: null };
    } catch (fallbackError: unknown) {
      const fallbackErrorMsg = `Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
      // Return the original error message if fallback also fails
      return { ip: null, error: `${errorMsg}. Fallback also failed: ${fallbackErrorMsg}` };
    }
  }
}

export const getPublicIpTool = defineTool({
  name: 'getPublicIp',
  description: 'Retrieves the public IP address of the machine running the MCP server.',
  inputSchema: GetPublicIpToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: GetPublicIpToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<GetPublicIpToolOutput> => { // Still returns the specific output type

    const { id } = input;

    // Removed try/catch, defineTool wrapper handles errors

    const publicIpInfo = await fetchPublicIp(); // fetchPublicIp handles its own errors/fallbacks

    if (publicIpInfo.error) {
      // Throw the error for defineTool to catch and format
      throw new Error(publicIpInfo.error);
    }

    if (publicIpInfo.ip) {
      const contentText = JSON.stringify(
        { success: true, id: id, result: publicIpInfo.ip },
        null,
        2,
      );
      return {
        success: true,
        id: id,
        result: publicIpInfo.ip, // Keep original field
        content: [{ type: 'text', text: contentText }], // Put JSON in content
      };
    }

    // If ip is null and no error was thrown (shouldn't happen with current fetchPublicIp logic)
    throw new Error('Public IP could not be determined.');
  },
});

// Ensure necessary types are still exported
// export type { GetPublicIpToolInput, GetPublicIpToolOutput }; // Removed duplicate export
