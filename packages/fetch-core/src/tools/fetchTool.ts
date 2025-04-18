import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

// Schema for a single fetch request item
const FetchInputItemSchema = z.object({
  id: z.string().optional(),
  url: z.string().url('Invalid URL format'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(), // Assuming string body for simplicity
  responseType: z.enum(['text', 'json', 'ignore']).default('text'),
});

// Main input schema: an array of fetch items
export const FetchToolInputSchema = z.object({
  items: z.array(FetchInputItemSchema).min(1, 'At least one fetch item is required.'),
});

// --- TypeScript Types ---
export type FetchInputItem = z.infer<typeof FetchInputItemSchema>;
export type FetchToolInput = z.infer<typeof FetchToolInputSchema>;

// Interface for a single fetch result item (matches existing structure)
export interface FetchResultItem {
  id?: string;
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any; // Parsed body (string, JSON object, or null)
  error?: string;
  suggestion?: string;
}

// Output interface for the tool
export interface FetchToolOutput extends BaseMcpToolOutput {
  results: FetchResultItem[];
  error?: string; // Optional overall error
}

// --- Tool Definition ---

// Re-implement the core logic within the execute method for better encapsulation
async function processSingleFetch(item: FetchInputItem): Promise<FetchResultItem> {
  const { id, url, method = 'GET', headers = {}, body, responseType = 'text' } = item;
  const resultItem: FetchResultItem = { id, success: false };

  try {
    console.log(`Fetching ${method} ${url}... (ID: ${id ?? 'N/A'})`);

    const requestOptions: RequestInit = {
      method,
      headers,
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = body;
      // Ensure Content-Type is set if body exists (common practice)
      if (!headers['Content-Type'] && !headers['content-type']) {
         console.warn(`Request body provided for ${url} but Content-Type header is missing. Defaulting to application/json.`);
         headers['Content-Type'] = 'application/json'; // Default assumption
         requestOptions.headers = headers; // Update options
      }
    }

    const response = await fetch(url, requestOptions);

    resultItem.status = response.status;
    resultItem.statusText = response.statusText;
    resultItem.headers = Object.fromEntries(response.headers.entries()); // Convert Headers object

    if (!response.ok) {
      // Attempt to read error body, but don't fail if it's empty/unreadable
      let errorBodyText: string | null = null;
      try {
        errorBodyText = await response.text();
      } catch { /* ignore body read error */ }
      throw new Error(`HTTP error! status: ${response.status}${errorBodyText ? ` - ${errorBodyText.substring(0, 100)}` : ''}`);
    }

    // Process response body based on requested type
    if (responseType === 'json') {
      resultItem.body = await response.json();
    } else if (responseType === 'text') {
      resultItem.body = await response.text();
    } else { // 'ignore' or undefined
      resultItem.body = null;
      // Consume body to prevent issues, even if ignoring
      await response.text();
    }

    resultItem.success = true;
    console.log(`Fetch successful for ${url}. (ID: ${id ?? 'N/A'})`);

  } catch (e: any) {
    resultItem.error = `Fetch failed for ${url}: ${e.message}`;
    resultItem.suggestion = 'Check URL, network connection, method, headers, and body. Ensure CORS is handled if running in a browser context.';
    console.error(resultItem.error);
  }
  return resultItem;
}


export const fetchTool: McpTool<typeof FetchToolInputSchema, FetchToolOutput> = {
  name: 'fetch',
  description: 'Performs one or more HTTP fetch requests sequentially.',
  inputSchema: FetchToolInputSchema,

  async execute(input: FetchToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<FetchToolOutput> {
    const { items } = input; // Input is validated by the server
    const results: FetchResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process requests sequentially for now
      for (const item of items) {
        const result = await processSingleFetch(item);
        results.push(result);
        if (!result.success) {
          overallSuccess = false; // If any request fails, overall success is false
        }
      }

      return {
        success: overallSuccess,
        results: results,
        // Provide a summary in content
        content: [{ type: 'text', text: `Processed ${items.length} fetch requests. Overall success: ${overallSuccess}` }],
      };
    } catch (e: any) {
      // Catch unexpected errors during the loop itself (should be rare)
      console.error(`Unexpected error during fetch tool execution: ${e.message}`);
      return {
        success: false,
        results: results, // Return partial results if any
        error: `Unexpected tool error: ${e.message}`,
        content: [],
      };
    }
  },
};

console.log('MCP Fetch Tool Loaded');