import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

// Input schema for a SINGLE fetch request
export const FetchToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
  url: z.string().url('Invalid URL format'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(), // Assuming string body for simplicity
  responseType: z.enum(['text', 'json', 'ignore']).default('text'),
});

// --- TypeScript Types ---
export type FetchToolInput = z.infer<typeof FetchToolInputSchema>;

// Output interface for a SINGLE fetch result
export interface FetchToolOutput extends BaseMcpToolOutput {
  // BaseMcpToolOutput provides 'success' and 'content'
  id?: string; // Corresponds to input id if provided
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any; // Parsed body (string, JSON object, or null)
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---
export const fetchTool: McpTool<typeof FetchToolInputSchema, FetchToolOutput> = {
  name: 'fetch',
  description: 'Performs a single HTTP fetch request.',
  inputSchema: FetchToolInputSchema, // Schema for single item

  async execute(input: FetchToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<FetchToolOutput> {
    // Logic now directly processes the single 'input' object.
    const { id, url, method = 'GET', headers = {}, body, responseType = 'text' } = input;

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

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      let responseBody: any = null;

      // Process response body based on requested type *before* checking response.ok
      // to potentially capture error bodies
      if (responseType === 'json') {
        try {
            responseBody = await response.json();
        } catch (jsonError: any) {
            // If JSON parsing fails on a non-ok response, try to get text body for error message
            if (!response.ok) {
                try { responseBody = await response.text(); } catch { /* ignore secondary read error */ }
            }
            // If JSON parsing fails on an ok response, it's a content error
            if (response.ok) {
                throw new Error(`Failed to parse JSON response: ${jsonError.message}`);
            }
            // Otherwise, the original HTTP error will be thrown below
        }
      } else if (responseType === 'text') {
        try {
            responseBody = await response.text();
        } catch (textError: any) {
             // Less likely to fail than JSON, but handle just in case
             if (!response.ok) { /* Allow HTTP error to be primary */ }
             else { throw new Error(`Failed to read text response: ${textError.message}`); }
        }
      } else { // 'ignore'
        try { await response.text(); } catch { /* Consume body safely */ }
      }

      if (!response.ok) {
        let errorDetail = '';
        if (typeof responseBody === 'string' && responseBody.length > 0) {
            errorDetail = ` - ${responseBody.substring(0, 150)}`; // Include part of the error body
        }
        throw new Error(`HTTP error! status: ${response.status}${errorDetail}`);
      }

      console.log(`Fetch successful for ${url}. (ID: ${id ?? 'N/A'})`);

      return {
        success: true,
        id: id,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        content: [{ type: 'text', text: `Fetch successful for ${url}. Status: ${response.status}` }],
      };

    } catch (e: any) {
      const errorMsg = `Fetch failed for ${url}: ${e.message}`;
      console.error(errorMsg);
      return {
        success: false,
        id: id,
        error: errorMsg,
        suggestion: 'Check URL, network connection, method, headers, and body. Ensure CORS is handled if running in a browser context.',
        content: [],
      };
    }
  },
};

console.log('MCP Fetch Tool (Single Operation) Loaded');