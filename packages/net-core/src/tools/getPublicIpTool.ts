import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart } from '@sylphlab/mcp-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import { GetPublicIpToolInputSchema } from './getPublicIpTool.schema.js';

// --- TypeScript Types ---
export type GetPublicIpToolInput = z.infer<typeof GetPublicIpToolInputSchema>;

// --- Output Types ---
export interface GetPublicIpResult {
  /** Optional ID from the input. */
  id?: string;
  /** Whether retrieving the public IP was successful. */
  success: boolean;
  /** The public IP address string, if successful. */
  ip?: string;
  /** Error message, if retrieval failed. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const GetPublicIpResultSchema = z.object({
  id: z.string().optional(),
  success: z.boolean(),
  ip: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const GetPublicIpOutputSchema = z.array(GetPublicIpResultSchema);

// --- Helper Function ---

// Helper to fetch public IP with fallback
async function fetchPublicIp(): Promise<{ ip: string | null; error: string | null }> {
  try {
    const response = await fetch('https://ipinfo.io/json');
    if (!response.ok) throw new Error(`ipinfo.io HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (typeof data?.ip !== 'string')
      throw new Error('IP address not found or invalid in response from ipinfo.io');
    return { ip: data.ip, error: null };
  } catch (e: unknown) {
    const errorMsg = `Failed to fetch public IP from ipinfo.io: ${e instanceof Error ? e.message : String(e)}`;
    // Attempt fallback
    try {
      const fallbackResponse = await fetch('https://api.ipify.org?format=json');
      if (!fallbackResponse.ok)
        throw new Error(`api.ipify.org HTTP error! status: ${fallbackResponse.status}`);
      const fallbackData = await fallbackResponse.json();
      if (typeof fallbackData?.ip !== 'string')
        throw new Error('IP address not found or invalid in fallback response from api.ipify.org');
      return { ip: fallbackData.ip, error: null };
    } catch (fallbackError: unknown) {
      const fallbackErrorMsg = `Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
      return { ip: null, error: `${errorMsg}. ${fallbackErrorMsg}` }; // Combine errors
    }
  }
}

// --- Tool Definition using defineTool ---
export const getPublicIpTool = defineTool({
  name: 'getPublicIp',
  description: 'Retrieves the public IP address of the machine running the MCP server.',
  inputSchema: GetPublicIpToolInputSchema,
  

  execute: async (
    input: GetPublicIpToolInput,
    _options: ToolExecuteOptions,
  ): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = GetPublicIpToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { id } = parsed.data; // Input schema might be empty

    const results: GetPublicIpResult[] = [];
    let ip: string | undefined;
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      const publicIpInfo = await fetchPublicIp();

      if (publicIpInfo.error) {
        // If helper returned an error (primary and fallback failed)
        throw new Error(publicIpInfo.error);
      }

      // If helper returned an IP (should always happen if no error)
      if (publicIpInfo.ip) {
        ip = publicIpInfo.ip;
        success = true;
      } else {
        // This case should theoretically not be reached if fetchPublicIp is correct
        throw new Error('Public IP could not be determined despite no specific error reported.');
      }
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown error retrieving public IP';
      suggestion =
        'Check network connectivity and reachability of public IP services (ipinfo.io, api.ipify.org).';
      ip = undefined;
    }

    // Push the single result
    results.push({
      id,
      success,
      ip,
      error,
      suggestion,
    });

    // Return the result wrapped in jsonPart
    return [jsonPart(results, GetPublicIpOutputSchema)];
  },
});

// Export necessary types
