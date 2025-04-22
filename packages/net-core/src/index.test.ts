import os from 'node:os'; // Import os for mocking
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import options type and Part
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import individual tools and types
import {
  type GetInterfacesToolInput,
  type GetPublicIpToolInput,
  getInterfacesTool,
  getPublicIpTool,
} from './index.js';
import type { GetInterfacesResult } from './tools/getInterfacesTool.js'; // Import correct result type
import type { GetPublicIpResult } from './tools/getPublicIpTool.js'; // Import correct result type

// Mock the os module for getInterfaces
vi.mock('node:os');

// Mock workspace root - not used by these tools' logic but required by execute signature
const mockWorkspaceRoot = '';
// Define options objects including workspaceRoot
const defaultOptions: McpToolExecuteOptions = { workspaceRoot: mockWorkspaceRoot };

// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  // console.log('DEBUG: getJsonResult received parts:', JSON.stringify(parts, null, 2)); // Keep commented for now
  const jsonPart = parts.find((part) => part.type === 'json');
  // console.log('DEBUG: Found jsonPart:', JSON.stringify(jsonPart, null, 2)); // Keep commented for now
  // Check if jsonPart exists and has a 'value' property (which holds the actual data)
  if (jsonPart && jsonPart.value !== undefined) {
    // console.log('DEBUG: typeof jsonPart.value:', typeof jsonPart.value); // Keep commented for now
    // console.log('DEBUG: Attempting to use jsonPart.value directly'); // Keep commented for now
    try {
      // Assuming the value is already the correct array type based on defineTool's outputSchema
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  // console.log('DEBUG: jsonPart or jsonPart.value is undefined or null.'); // Keep commented for now
  return undefined;
}

describe('getPublicIpTool.execute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock fetch for getPublicIp (simulate success)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ip: '8.8.8.8' }),
    } as Response);
  });

  it('should fetch public IP successfully', async () => {
    const input: GetPublicIpToolInput = { id: 'a' };
    const parts = await getPublicIpTool.execute(input, defaultOptions);
    const results = getJsonResult<GetPublicIpResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.ip).toBe('8.8.8.8');
    expect(itemResult.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://ipinfo.io/json');
  });

  it('should handle public IP fetch error', async () => {
    // Mock fetch to fail primary and fallback
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

    const input: GetPublicIpToolInput = { id: 'd' };
    const parts = await getPublicIpTool.execute(input, defaultOptions);
    const results = getJsonResult<GetPublicIpResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.ip).toBeUndefined();
    expect(itemResult.error).toContain(
      'Failed to fetch public IP from ipinfo.io: ipinfo.io HTTP error! status: 500',
    );
    expect(itemResult.error).toContain('Fallback failed: api.ipify.org HTTP error! status: 503');
    expect(itemResult.suggestion).toBe(
      'Check network connectivity and reachability of public IP services (ipinfo.io, api.ipify.org).',
    );
  });

  it('should handle network error during public IP fetch', async () => {
    // Mock fetch to throw a network error on both attempts
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network failed'));

    const input: GetPublicIpToolInput = { id: 'g' };
    const parts = await getPublicIpTool.execute(input, defaultOptions);
    const results = getJsonResult<GetPublicIpResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.ip).toBeUndefined();
    expect(itemResult.error).toContain('Failed to fetch public IP from ipinfo.io: Network failed');
    expect(itemResult.error).toContain('Fallback failed: Network failed');
    expect(itemResult.suggestion).toBe(
      'Check network connectivity and reachability of public IP services (ipinfo.io, api.ipify.org).',
    );
  });
});

describe('getInterfacesTool.execute', () => {
  const mockInterfaces = {
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: '127.0.0.1/8',
      },
    ],
    eth0: [
      {
        address: '192.168.1.100',
        netmask: '255.255.255.0',
        family: 'IPv4',
        mac: '01:02:03:04:05:06',
        internal: false,
        cidr: '192.168.1.100/24',
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Mock os.networkInterfaces()
    vi.mocked(os.networkInterfaces).mockReturnValue(mockInterfaces);
  });

  it('should get network interfaces successfully', async () => {
    const input: GetInterfacesToolInput = { id: 'b' };
    const parts = await getInterfacesTool.execute(input, defaultOptions);
    const results = getJsonResult<GetInterfacesResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.result).toEqual(mockInterfaces); // Check the actual result object
    expect(itemResult.error).toBeUndefined();
    expect(os.networkInterfaces).toHaveBeenCalledTimes(1);
  });

  it('should handle errors from os.networkInterfaces', async () => {
    const mockError = new Error('OS Error');
    vi.mocked(os.networkInterfaces).mockImplementation(() => {
      throw mockError;
    });

    const input: GetInterfacesToolInput = { id: 'h' };
    const parts = await getInterfacesTool.execute(input, defaultOptions);
    const results = getJsonResult<GetInterfacesResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toBe(mockError.message); // Error comes directly from the catch block
    expect(itemResult.suggestion).toBe(
      'Check system permissions or if network interfaces are available.',
    );
  });
});
