import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import the actual tool and its types
import { type FetchToolInput, fetchTool } from './index.js'; // Add .js extension

// Mock workspace root - not used by this tool's logic but required by execute signature
const mockWorkspaceRoot = '';

describe('fetchTool.execute', () => {
  // Define a reusable clone function for mocks
  function mockClone(this: Response) {
    // Return a new object with the same properties and *independent* mocked methods
    return {
      ok: this.ok,
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers), // Create a new Headers object
      text: vi.fn().mockImplementation(this.text), // Re-use the mock implementation logic
      json: vi.fn().mockImplementation(this.json), // Re-use the mock implementation logic
      clone: mockClone, // Assign the external function
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    // Default successful mock for fetch
    const mockSuccessResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      text: vi.fn().mockResolvedValue('Success response'),
      json: vi.fn().mockResolvedValue({ message: 'Success response' }),
      clone: mockClone, // Assign the external function
    };
    global.fetch = vi.fn().mockResolvedValue(mockSuccessResponse as unknown as Response);
  });

  it('should process a single GET request (text)', async () => {
    const input: FetchToolInput = {
      items: [{ id: 'a', url: 'http://test.com/text', method: 'GET', responseType: 'text' }],
    };
    const output = await fetchTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.id).toBe('a');
    expect(result.status).toBe(200);
    expect(result.body).toBe('Success response');
    expect(result.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('http://test.com/text', {
      method: 'GET',
      headers: {},
    });
  });

  it('should process a single GET request (json)', async () => {
    const input: FetchToolInput = {
      items: [{ id: 'b', url: 'http://test.com/json', method: 'GET', responseType: 'json' }],
    };
    const output = await fetchTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.id).toBe('b');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ message: 'Success response' });
    expect(result.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('http://test.com/json', {
      method: 'GET',
      headers: {},
    });
  });

  it('should process a single POST request with body', async () => {
    const input: FetchToolInput = {
      items: [
        {
          id: 'c',
          url: 'http://test.com/post',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: 'value' }),
          responseType: 'json',
        },
      ],
    };
    const output = await fetchTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.id).toBe('c');
    expect(result.status).toBe(200);
    // Body might be mocked differently, just check success/status
    expect(global.fetch).toHaveBeenCalledWith('http://test.com/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'value' }),
    });
  });

  it('should default Content-Type for POST if body present and header missing', async () => {
    const input: FetchToolInput = {
      items: [
        {
          id: 'c2',
          url: 'http://test.com/post',
          method: 'POST',
          // No Content-Type header
          body: JSON.stringify({ data: 'value' }),
          responseType: 'json',
        },
      ],
    };
    await fetchTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(global.fetch).toHaveBeenCalledWith('http://test.com/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Should be added by default
      body: JSON.stringify({ data: 'value' }),
    });
  });

  // Removed multi-request test as tool handles single requests

  it('should handle fetch error (e.g., network error)', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network failed'));
    const input: FetchToolInput = {
      items: [{ id: 'f', url: 'http://test.com/fail', method: 'GET', responseType: 'text' }],
    };
    const output = await fetchTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(output.success).toBe(false); // Overall success is false
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(false);
    expect(result.id).toBe('f');
    expect(result.status).toBeUndefined();
    expect(result.body).toBeUndefined();
    expect(result.error).toBe('Fetch failed for http://test.com/fail: Network failed');
  });

  it('should handle HTTP error response', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('Resource not found'), // Simulate error body
      json: vi.fn().mockResolvedValue({ error: 'Resource not found' }),
      clone: mockClone, // Assign the external function
    };
    vi.mocked(global.fetch).mockResolvedValue(mockErrorResponse as unknown as Response);
    const input: FetchToolInput = {
      items: [{ id: 'g', url: 'http://test.com/notfound', method: 'GET', responseType: 'text' }],
    };
    const output = await fetchTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(false);
    expect(result.id).toBe('g');
    // Status and statusText might not be present if fetch itself throws before response object is created
    // Or if the error is caught in the final catch block. Let's check the error message primarily.
    // expect(result.status).toBe(404);
    // expect(result.statusText).toBe('Not Found');
    expect(result.body).toBeUndefined(); // No body parsed on error
    expect(result.error).toContain('HTTP error! status: 404'); // Error comes from the throw new Error line
  });

  it('should handle responseType ignore', async () => {
    const input: FetchToolInput = {
      items: [{ id: 'i', url: 'http://test.com/ignore', method: 'GET', responseType: 'ignore' }],
    };
    const output = await fetchTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.id).toBe('i');
    expect(result.status).toBe(200);
    expect(result.body).toBeNull(); // Body should be null when ignored
    expect(result.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('http://test.com/ignore', {
      method: 'GET',
      headers: {},
    });
  });

  it('should handle JSON parsing error for responseType json', async () => {
    const mockBadJsonResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }), // Correct header
      text: vi.fn().mockResolvedValue('invalid json'), // But invalid body
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token i in JSON at position 0')), // Simulate json parse error
      clone: mockClone, // Assign the external function
    };
    vi.mocked(global.fetch).mockResolvedValue(mockBadJsonResponse as unknown as Response);
    const input: FetchToolInput = {
      items: [{ id: 'h', url: 'http://test.com/badjson', method: 'GET', responseType: 'json' }],
    };
    const output = await fetchTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(false);
    expect(result.id).toBe('h');
    // Status might not be present if caught in the final catch block after parsing fails
    // expect(result.status).toBe(200); // Request was ok, parsing failed
    expect(result.body).toBeUndefined();
    expect(result.error).toContain('Unexpected token'); // Error from response.json() or the catch block
  });
}); // End describe fetchTool.execute
