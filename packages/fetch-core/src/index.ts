// Define Input and Output structures for batch processing
interface FetchInputItem {
  id?: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'; // Add others if needed
  headers?: Record<string, string>;
  body?: string; // Assuming string body for simplicity, could be other types
  responseType?: 'text' | 'json' | 'ignore'; // How to handle response body
}

interface FetchResultItem {
  id?: string;
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any; // Parsed body (string, JSON object, or null)
  error?: string;
  suggestion?: string;
}

/**
 * Processes multiple fetch requests.
 * Note: This implementation processes requests sequentially.
 * A more advanced version could use Promise.all for concurrency.
 * @param items An array of FetchInputItem objects.
 * @returns A promise resolving to an array of FetchResultItem objects.
 */
export async function processFetchRequests(items: FetchInputItem[]): Promise<FetchResultItem[]> {
  const results: FetchResultItem[] = [];

  for (const item of items) {
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
      // Note: Could potentially parse e.message for status codes if needed
    }
    results.push(resultItem);
  }

  return results;
}


console.log('MCP Fetch Core Package Loaded');

export type { FetchInputItem, FetchResultItem };
