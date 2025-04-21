import type { z } from 'zod';
import { type McpTool, type BaseMcpToolOutput, McpToolInput, type McpToolExecuteOptions } from '@sylphlab/mcp-core';
import { fetchToolInputSchema, type FetchItemSchema } from './fetchTool.schema.js'; // Import schemas (re-added .js)

// --- TypeScript Types ---
export type FetchInputItem = z.infer<typeof FetchItemSchema>;
export type FetchToolInput = z.infer<typeof fetchToolInputSchema>;

// Interface for a single fetch result item
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

// Output interface for the tool (includes multiple results)
export interface FetchToolOutput extends BaseMcpToolOutput {
  results: FetchResultItem[];
  error?: string; // Optional overall error if the tool itself fails unexpectedly
}

// --- Tool Definition ---

// Helper function to process a single fetch item
async function processSingleFetch(item: FetchInputItem): Promise<FetchResultItem> {
  const { id, url, method = 'GET', headers = {}, body, responseType = 'text' } = item;
  const resultItem: FetchResultItem = { id, success: false }; // Initialize success to false

  try {
    console.log(`Fetching ${method} ${url}... (ID: ${id ?? 'N/A'})`);

    const requestOptions: RequestInit = {
      method,
      headers,
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = body;
      if (!headers['Content-Type'] && !headers['content-type']) {
         console.warn(`Request body provided for ${url} but Content-Type header is missing. Defaulting to application/json.`);
         headers['Content-Type'] = 'application/json';
         requestOptions.headers = headers;
      }
    }

    const response = await fetch(url, requestOptions);

    resultItem.status = response.status;
    resultItem.statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
    resultItem.headers = responseHeaders;

    let responseBody: any = null;
    let bodyForError: string | null = null;

    // Try to read body regardless of status first, to capture error details
    try {
        // Clone response to read body multiple times if needed (e.g., text for error, json for success)
        const resClone = response.clone();
        if (responseType === 'json') {
            responseBody = await response.json();
            // Also get text for potential error message inclusion
            try { bodyForError = await resClone.text(); } catch { /* ignore */ }
        } else { // 'text' or 'ignore'
            responseBody = await response.text();
            bodyForError = responseBody; // Use the same text
            if (responseType === 'ignore') {
                responseBody = null; // Discard if ignoring
            }
        }
    } catch (bodyError: any) {
        // Handle body reading/parsing errors
        if (response.ok) { // If status was OK, this is a content error
            throw new Error(`Failed to read/parse response body: ${bodyError.message}`);
        } else {
            // If status was not OK, try to get text for error message, but prioritize HTTP error
            try { bodyForError = await response.text(); } catch { /* ignore */ }
        }
    }

    if (!response.ok) {
      let errorDetail = '';
      if (typeof bodyForError === 'string' && bodyForError.length > 0) {
          errorDetail = ` - ${bodyForError.substring(0, 150)}`;
      }
      throw new Error(`HTTP error! status: ${response.status}${errorDetail}`);
    }

    // If we reached here, the request was successful (status ok)
    resultItem.body = responseBody;
    resultItem.success = true;
    console.log(`Fetch successful for ${url}. (ID: ${id ?? 'N/A'})`);

  } catch (e: any) {
    resultItem.error = `Fetch failed for ${url}: ${e.message}`;
    resultItem.suggestion = 'Check URL, network connection, method, headers, and body. Ensure CORS is handled if running in a browser context.';
    console.error(resultItem.error);
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}


export const fetchTool: McpTool<typeof fetchToolInputSchema, FetchToolOutput> = {
  name: 'fetch', // Keep tool name simple
  description: 'Performs one or more HTTP fetch requests sequentially.',
  inputSchema: fetchToolInputSchema, // Schema expects { items: [...] }

  async execute(input: FetchToolInput, options: McpToolExecuteOptions): Promise<FetchToolOutput> { // Remove workspaceRoot, require options
    // Input validation happens before execute in the registerTools helper
    const { items } = input;
    // workspaceRoot is now in options.workspaceRoot if needed
    const results: FetchResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process requests sequentially
      for (const item of items) {
        const result = await processSingleFetch(item); // Process each item
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
        }
      }

      // Serialize the detailed results into the content field
      const contentText = JSON.stringify({
          summary: `Processed ${items.length} fetch requests. Overall success: ${overallSuccess}`,
          results: results
      }, null, 2); // Pretty-print JSON

      return {
        success: overallSuccess,
        results: results, // Keep original results field too
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (e: any) {
      // Catch unexpected errors during the loop itself (should be rare)
      console.error(`Unexpected error during fetch tool execution: ${e.message}`);
      const errorMsg = `Unexpected tool error: ${e.message}`;
      const errorContentText = JSON.stringify({
          error: errorMsg,
          results: results // Include partial results in error content too
      }, null, 2);
      return {
        success: false,
        results: results, // Keep partial results here too
        error: errorMsg, // Keep top-level error
        content: [{ type: 'text', text: errorContentText }], // Put error JSON in content
      };
    }
  },
};

console.log('MCP Fetch Core Tool (Batch Operation) Loaded');