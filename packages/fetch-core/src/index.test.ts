import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processFetchRequests, FetchInputItem, FetchResultItem } from './index';

describe('processFetchRequests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default successful mock for fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      text: async () => 'Success response',
      json: async () => ({ message: 'Success response' }),
    } as Response);
  });

  it('should process a single GET request (text)', async () => {
    const items: FetchInputItem[] = [{ id: 'a', url: 'http://test.com/text' }];
    const results = await processFetchRequests(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'a',
      success: true,
      status: 200,
      body: 'Success response',
    }));
    expect(global.fetch).toHaveBeenCalledWith('http://test.com/text', { method: 'GET', headers: {} });
  });

  it('should process a single GET request (json)', async () => {
    const items: FetchInputItem[] = [{ id: 'b', url: 'http://test.com/json', responseType: 'json' }];
    const results = await processFetchRequests(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'b',
      success: true,
      status: 200,
      body: { message: 'Success response' },
    }));
    expect(global.fetch).toHaveBeenCalledWith('http://test.com/json', { method: 'GET', headers: {} });
  });

   it('should process a single POST request with body', async () => {
    const items: FetchInputItem[] = [{
      id: 'c',
      url: 'http://test.com/post',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'value' }),
      responseType: 'json'
    }];
    const results = await processFetchRequests(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({ id: 'c', success: true, status: 200 }));
    expect(global.fetch).toHaveBeenCalledWith('http://test.com/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'value' })
    });
  });

   it('should default Content-Type for POST if body present and header missing', async () => {
    const items: FetchInputItem[] = [{
      id: 'c2',
      url: 'http://test.com/post',
      method: 'POST',
      // No Content-Type header
      body: JSON.stringify({ data: 'value' }),
      responseType: 'json'
    }];
    await processFetchRequests(items); // Don't need result, just check mock call

    expect(global.fetch).toHaveBeenCalledWith('http://test.com/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Should be added by default
      body: JSON.stringify({ data: 'value' })
    });
  });


  it('should process multiple requests', async () => {
    const items: FetchInputItem[] = [
      { id: 'd', url: 'http://test.com/1' },
      { id: 'e', url: 'http://test.com/2', method: 'POST', body: '{}', headers: {'Content-Type': 'application/json'} },
    ];
    const results = await processFetchRequests(items);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ id: 'd', success: true }));
    expect(results[1]).toEqual(expect.objectContaining({ id: 'e', success: true }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle fetch error (e.g., network error)', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network failed'));
    const items: FetchInputItem[] = [{ id: 'f', url: 'http://test.com/fail' }];
    const results = await processFetchRequests(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'f',
      success: false,
      error: 'Fetch failed for http://test.com/fail: Network failed',
    }));
  });

  it('should handle HTTP error response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: async () => 'Resource not found', // Simulate error body
      json: async () => ({ error: 'Resource not found' }),
    } as Response);
    const items: FetchInputItem[] = [{ id: 'g', url: 'http://test.com/notfound' }];
    const results = await processFetchRequests(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'g',
      success: false,
      status: 404,
      statusText: 'Not Found',
      error: expect.stringContaining('HTTP error! status: 404 - Resource not found'),
    }));
  });

  it('should handle responseType ignore', async () => {
    const items: FetchInputItem[] = [{ id: 'i', url: 'http://test.com/ignore', responseType: 'ignore' }];
    const results = await processFetchRequests(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'i',
      success: true,
      status: 200,
      body: null, // Body should be null when ignored
    }));
    expect(global.fetch).toHaveBeenCalledWith('http://test.com/ignore', { method: 'GET', headers: {} });
  });

  it('should handle JSON parsing error for responseType json', async () => {
     vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }), // Correct header
      text: async () => 'invalid json', // But invalid body
      json: async () => { throw new SyntaxError('Unexpected token i in JSON at position 0'); }, // Simulate json parse error
    } as any as Response); // Use less strict cast
     const items: FetchInputItem[] = [{ id: 'h', url: 'http://test.com/badjson', responseType: 'json' }];
     const results = await processFetchRequests(items);

     expect(results).toHaveLength(1);
     expect(results[0]).toEqual(expect.objectContaining({
       id: 'h',
       success: false,
       status: 200, // Request was ok, parsing failed
       error: expect.stringContaining('Unexpected token'), // Error from response.json()
     }));
  });

}); // End describe processFetchRequests
