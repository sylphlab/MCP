import { defineTool } from '@sylphlab/tools-core';
import { jsonPart, textPart } from '@sylphlab/tools-core'; // Import textPart
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
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

// Helper function to process a single fetch item, throws on error
async function processSingleFetch(item: FetchInputItem): Promise<FetchResultItem> {
  const { id, url, method = 'GET', headers = {}, body, responseType = 'text' } = item;
  const resultItemBase: Omit<FetchResultItem, 'error' | 'suggestion' | 'body'> = { id, success: false }; // Start without body

  try { // Add try block specifically for the fetch operation and initial response handling
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

    // Process headers regardless of status
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: unknown = null;
    let bodyTextForError: string | undefined;

    // If response is not OK, attempt to read body for error and throw
    if (!response.ok) {
      try {
        bodyTextForError = await response.text();
      } catch { /* ignore inability to read body */ }
      const errorDetail = bodyTextForError ? `: ${bodyTextForError.substring(0, 150)}` : '';
      throw new Error(`Fetch failed with status ${response.status} ${response.statusText}${errorDetail}`);
    }

    // If response is OK, parse body based on responseType
    try {
      if (responseType === 'json') {
        responseBody = await response.json();
      } else if (responseType === 'text') {
        responseBody = await response.text();
      } else { // 'ignore' or unknown
        responseBody = null;
        await response.text(); // Consume body
      }
    } catch (parseError: unknown) {
      // Handle body parsing errors after confirming response.ok
      throw new Error(
        `Successfully fetched from ${url} (status ${response.status}), but failed to parse response body as ${responseType}: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    // Success case: return full result
    return {
      ...resultItemBase,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      success: true,
    };

  } catch (e: unknown) {
    // Catch initial fetch errors (network, DNS, etc.) or errors thrown above
    const errorMsg = e instanceof Error ? e.message : 'Unknown fetch error';
    // Re-throw error to be caught by the main execute block
    throw new Error(`Fetch failed for ${url}: ${errorMsg}`);
  }
}

// --- Tool Definition using defineTool ---
import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

export const fetchTool = defineTool({
  name: 'fetch', // Keep tool name simple
  description: 'Performs one or more HTTP fetch requests sequentially.',
  inputSchema: fetchToolInputSchema,
  contextSchema: BaseContextSchema, // Add context schema
  // Use the array schema

  execute: async (
    // Use new signature with destructuring
    { args }: { context: ToolExecuteOptions; args: FetchToolInput }
  ): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = fetchToolInputSchema.safeParse(args); // Validate args
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items } = parsed.data; // Get data from parsed args

    const results: FetchResultItem[] = [];

    // Process requests sequentially, re-throwing the first error encountered
    try {
      for (const item of items) {
        const result = await processSingleFetch(item);
        results.push(result);
      }
    } catch (e) {
      // If processSingleFetch throws, re-throw it to fail the tool execution
      // The adapter layer will catch this and return an error result.
      if (e instanceof Error) {
         // Construct a more informative error message if possible
         const baseMessage = e.message.startsWith('Fetch failed for') ? e.message : `Fetch execution failed: ${e.message}`;
         throw new Error(baseMessage);
      }
      throw new Error(`Fetch execution failed: ${String(e)}`);
    }


    // If loop completed without errors, all requests succeeded.
    // Always return the full results array wrapped in jsonPart.
    return [jsonPart(results, FetchToolOutputSchema)];
  },
});
