import { describe, it, expect, vi, beforeEach } from 'vitest'; // Removed afterEach as it wasn't used
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { fetchTool, type FetchToolInput, type FetchResultItem } from './fetchTool.js'; // Import types with .js extension
import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

// Mock the global fetch function
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to extract JSON result
function getJsonResult<T>(parts: Part[]): T | undefined {
  const jsonPart = parts.find((part): part is Part & { type: 'json' } => part.type === 'json'); // Type predicate
  return jsonPart?.value as T | undefined;
}

const mockContext: ToolExecuteOptions = { workspaceRoot: '/test' }; // Rename to mockContext

describe('fetchTool', () => {

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should perform a basic GET request and return text', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      text: async () => 'Success response',
    };
    mockFetch.mockResolvedValue(mockResponse);

    const args: FetchToolInput = { items: [{ url: 'https://example.com/data', method: 'GET', responseType: 'text' }] }; // Rename to args
    const parts = await fetchTool.execute({ context: mockContext, args }); // Use new signature

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/data', {
        method: 'GET',
        headers: {},
        body: undefined,
    });
    // Expect jsonPart containing the results array
    const jsonResult = getJsonResult<FetchResultItem[]>(parts);
    expect(jsonResult).toBeDefined();
    expect(jsonResult).toHaveLength(1);
    // Check the body of the first result item for the text content
    expect(jsonResult?.[0]?.body).toBe('Success response');
  });

  it('should perform a GET request and return JSON', async () => {
    const mockJsonResponse = { data: 'test' };
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockJsonResponse,
      text: async () => JSON.stringify(mockJsonResponse), // Fallback for text format
    };
    mockFetch.mockResolvedValue(mockResponse);

    const args: FetchToolInput = { items: [{ url: 'https://example.com/json', method: 'GET', responseType: 'json' }] }; // Rename to args
    const parts = await fetchTool.execute({ context: mockContext, args }); // Use new signature

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/json', {
        method: 'GET',
        headers: {},
        body: undefined,
    });
    // Expect jsonPart containing the results array
    const jsonResult = getJsonResult<FetchResultItem[]>(parts);
    expect(jsonResult).toBeDefined();
    expect(jsonResult).toHaveLength(1);
    // Check the body of the first result item for the JSON content
    expect(jsonResult?.[0]?.body).toEqual(mockJsonResponse);
  });

   it('should perform a POST request with JSON body', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ id: 123 }),
      text: async () => '{"id":123}',
    };
    mockFetch.mockResolvedValue(mockResponse);

    const args: FetchToolInput = { // Rename to args
      items: [{ // Wrap in items array
        url: 'https://example.com/create',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
        body: JSON.stringify({ name: 'new item' }),
        responseType: 'json', // Rename responseFormat to responseType
      }]
    };
    const parts = await fetchTool.execute({ context: mockContext, args }); // Use new signature

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      body: JSON.stringify({ name: 'new item' }),
    });
    // Expect jsonPart containing the results array
    const jsonResult = getJsonResult<FetchResultItem[]>(parts);
    expect(jsonResult).toBeDefined();
    expect(jsonResult).toHaveLength(1);
     // Check the body of the first result item for the JSON content
    expect(jsonResult?.[0]?.body).toEqual({ id: 123 });
  });

  it('should handle fetch error', async () => {
    const fetchError = new Error('Network Error');
    mockFetch.mockRejectedValue(fetchError);

    const args: FetchToolInput = { items: [{ url: 'https://invalid.url', method: 'GET', responseType: 'text' }] }; // Rename to args

    await expect(fetchTool.execute({ context: mockContext, args })) // Use new signature
      .rejects
      // Error message now includes the URL and is re-thrown by execute
      .toThrow('Fetch failed for https://invalid.url: Network Error');

    expect(mockFetch).toHaveBeenCalledWith('https://invalid.url', {
        method: 'GET',
        headers: {},
        body: undefined,
    });
  });

  it('should handle non-ok response status', async () => {
     const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      text: async () => 'Resource not found',
    };
    mockFetch.mockResolvedValue(mockResponse);

    const args: FetchToolInput = { items: [{ url: 'https://example.com/missing', method: 'GET', responseType: 'text' }] }; // Rename to args

     await expect(fetchTool.execute({ context: mockContext, args })) // Use new signature
       .rejects
        // Error message now includes the URL and status text, and is re-thrown by execute
       .toThrow('Fetch failed for https://example.com/missing: Fetch failed with status 404 Not Found: Resource not found');

     expect(mockFetch).toHaveBeenCalledWith('https://example.com/missing', {
        method: 'GET',
        headers: {},
        body: undefined,
    });
  });

  // TODO: Add tests for different responseFormat options ('text', 'json', 'binary' if implemented)
  // TODO: Add tests for handling different Content-Types correctly when responseFormat is 'auto' (default)
});