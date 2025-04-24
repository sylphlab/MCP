import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart } from '@sylphlab/mcp-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import { type FetchItemSchema, fetchToolInputSchema } from './fetchTool.schema.js';

// --- TypeScript Types ---
export type FetchInputItem = z.infer<typeof FetchItemSchema>;
export type FetchToolInput = z.infer<typeof fetchToolInputSchema>;

// --- Output Types ---
// Interface for a single fetch result item
export interface FetchResultItem {
  /** Optional ID from the input item. */
  id?: string;
  /** Whether the fetch operation for this item was successful (HTTP status 2xx). */
  success: boolean;
  /** HTTP status code of the response. */
  status?: number;
  /** HTTP status text of the response. */
  statusText?: string;
  /** Response headers. */
  headers?: Record<string, string>;
  /** Parsed response body (string, JSON object, or null if ignored), if successful. */
  body?: unknown;
  /** Error message, if the operation failed. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const FetchResultItemSchema = z.object({
  id: z.string().optional(),
  success: z.boolean(),
  status: z.number().optional(),
  statusText: z.string().optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const FetchToolOutputSchema = z.array(FetchResultItemSchema);

// --- Helper Function ---

// Helper function to process a single fetch item
async function processSingleFetch(item: FetchInputItem): Promise<FetchResultItem> {
  const { id, url, method = 'GET', headers = {}, body, responseType = 'text' } = item;
  const resultItem: FetchResultItem = { id, success: false };

  try {
    const requestOptions: RequestInit = {
      method,
      headers: headers as HeadersInit, // Cast headers
    };

    // Only add body for relevant methods and if body is provided
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.body = body;
      // Default Content-Type if not provided
      if (
        !requestOptions.headers ||
        (!(requestOptions.headers as Record<string, string>)['Content-Type'] &&
          !(requestOptions.headers as Record<string, string>)['content-type'])
      ) {
        // Ensure headers is an object before assigning
        if (
          typeof requestOptions.headers !== 'object' ||
          requestOptions.headers === null ||
          Array.isArray(requestOptions.headers)
        ) {
          requestOptions.headers = {};
        }
        (requestOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
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

    // Try reading body text first for potential error messages
    try {
      bodyForError = await response.clone().text(); // Clone to read text
    } catch {
      // Ignore error reading body text for error reporting
    }

    if (!response.ok) {
      let errorDetail = '';
      if (typeof bodyForError === 'string' && bodyForError.length > 0) {
        errorDetail = ` - Body: ${bodyForError.substring(0, 150)}`; // Limit error body length
      }
      throw new Error(`HTTP error! Status: ${response.status}${errorDetail}`);
    }

    // If response is OK, parse body based on responseType
    try {
      if (responseType === 'json') {
        // Use the original response stream for JSON parsing
        responseBody = await response.json();
      } else if (responseType === 'text') {
        // We already read the text into bodyForError
        responseBody = bodyForError;
      } else {
        // 'ignore' or unknown - body is null
        responseBody = null;
      }
    } catch (parseError: unknown) {
      // Handle JSON parsing error specifically
      throw new Error(
        `Failed to parse response body as ${responseType}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
    }

    resultItem.body = responseBody;
    resultItem.success = true;
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    resultItem.error = `Fetch failed for ${url}: ${errorMsg}`;
    // Provide suggestions based on error type
    if (errorMsg.includes('Failed to parse response body')) {
      resultItem.suggestion = `The server responded with status ${resultItem.status}, but the response body was not valid ${responseType}. Check the 'responseType' parameter or the server's response format.`;
    } else if (errorMsg.includes('HTTP error')) {
      resultItem.suggestion =
        'The server returned an error status code. Check the error message body (if available) and the request details (URL, method, headers, body).';
    } else if (errorMsg.includes('fetch') || errorMsg.includes('Network request failed')) {
      // More generic network errors
      resultItem.suggestion =
        'Check URL, network connection, DNS resolution, and potential CORS issues if running in a browser.';
    } else {
      resultItem.suggestion =
        'Check URL, network connection, method, headers, body, and potential CORS issues.';
    }
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const fetchTool = defineTool({
  name: 'fetch', // Keep tool name simple
  description: 'Performs one or more HTTP fetch requests sequentially.',
  inputSchema: fetchToolInputSchema,
  // Use the array schema

  execute: async (input: FetchToolInput, _options: ToolExecuteOptions): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = fetchToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items } = parsed.data;

    const results: FetchResultItem[] = [];

    // Process requests sequentially
    for (const item of items) {
      const result = await processSingleFetch(item);
      results.push(result);
    }

    // Return the results wrapped in jsonPart
    return [jsonPart(results, FetchToolOutputSchema)];
  },
});
