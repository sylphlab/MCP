import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import { type FetchItemSchema, fetchToolInputSchema } from './fetchTool.schema.js'; // Import schemas (re-added .js)

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
  body?: unknown; // Parsed body (string, JSON object, or null)
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
    const requestOptions: RequestInit = {
      method,
      headers,
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = body;
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
        requestOptions.headers = headers;
      }
    }

    const response = await fetch(url, requestOptions);

    resultItem.status = response.status;
    resultItem.statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    resultItem.headers = responseHeaders;

    let responseBody: unknown = null;
    let bodyForError: string | null = null;

    // Try to read body regardless of status first, to capture error details
    try {
      // Clone response to read body multiple times if needed (e.g., text for error, json for success)
      const resClone = response.clone();
      if (responseType === 'json') {
        responseBody = await response.json();
        // Also get text for potential error message inclusion
        try {
          bodyForError = await resClone.text();
        } catch {
          /* ignore */
        }
      } else {
        // 'text' or 'ignore'
        responseBody = await response.text();
        if (typeof responseBody === 'string') {
          bodyForError = responseBody; // Use the same text
        }
        if (responseType === 'ignore') {
          responseBody = null; // Discard if ignoring
        }
      }
    } catch (bodyError: unknown) {
      // Handle body reading/parsing errors
      const bodyErrorMsg = bodyError instanceof Error ? bodyError.message : 'Unknown body error';
      if (response.ok) {
        // If status was OK, this is a content error
        throw new Error(`Failed to read/parse response body: ${bodyErrorMsg}`);
      }
      // If status was not OK, try to get text for error message, but prioritize HTTP error
      try {
        bodyForError = await response.text();
      } catch {
        /* ignore */
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
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    resultItem.error = `Fetch failed for ${url}: ${errorMsg}`;
    resultItem.suggestion =
      'Check URL, network connection, method, headers, and body. Ensure CORS is handled if running in a browser context.';
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}

export const fetchTool = defineTool({
  name: 'fetch', // Keep tool name simple
  description: 'Performs one or more HTTP fetch requests sequentially.',
  inputSchema: fetchToolInputSchema, // Schema expects { items: [...] }

  execute: async ( // Core logic passed to defineTool
    input: FetchToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<FetchToolOutput> => { // Still returns the specific output type

    // Input validation is handled by registerTools/SDK before execute is called
    const { items } = input;

    const results: FetchResultItem[] = [];
    let overallSuccess = true;

    // Removed the outermost try/catch block; defineTool handles unexpected errors

    // Process requests sequentially
    for (const item of items) {
      // processSingleFetch already includes its own try/catch for fetch errors
      const result = await processSingleFetch(item);
      results.push(result);
      if (!result.success) {
        overallSuccess = false; // Mark overall as failed if any item fails
      }
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Processed ${items.length} fetch requests. Overall success: ${overallSuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess,
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { FetchToolInput, FetchToolOutput, FetchResultItem, FetchInputItem }; // Removed duplicate export
