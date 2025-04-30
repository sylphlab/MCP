import os from 'node:os'; // Import os for mocking
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Import options type and Part
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
import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

// Mock the os module for getInterfaces
vi.mock('node:os');

// Mock workspace root - not used by these tools' logic but required by execute signature
const mockContext: ToolExecuteOptions = { workspaceRoot: '' }; // Use a mock context object

// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  const jsonPart = parts.find((part): part is Part & { type: 'json' } => part.type === 'json'); // Type predicate
  // Check if jsonPart exists and has a 'value' property (which holds the actual data)
  if (jsonPart && jsonPart.value !== undefined) {
    try {
      // Assuming the value is already the correct array type based on defineTool's outputSchema
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
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
    const args: GetPublicIpToolInput = { id: 'a' }; // Rename to args
    // Use new signature
    const parts = await getPublicIpTool.execute({ context: mockContext, args });
    const results = getJsonResult<GetPublicIpResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
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

    const args: GetPublicIpToolInput = { id: 'd' }; // Rename to args
    const parts = await getPublicIpTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<GetPublicIpResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
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

    const args: GetPublicIpToolInput = { id: 'g' }; // Rename to args
    const parts = await getPublicIpTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<GetPublicIpResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
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
  // Define mock data that conforms to os.NetworkInterfaceInfo[]
  const mockInterfaces: { [key: string]: os.NetworkInterfaceInfo[] } = {
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: '127.0.0.1/8',
        // scopeid is only for IPv6, so it should be undefined for IPv4
      },
      { // Example IPv6 loopback
        address: '::1',
        netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
        family: 'IPv6',
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: '::1/128',
        scopeid: 0, // scopeid is required for IPv6
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
        // scopeid undefined for IPv4
      },
       { // Example IPv6 eth0
        address: 'fe80::1234:5678:9abc:def0',
        netmask: 'ffff:ffff:ffff:ffff::',
        family: 'IPv6',
        mac: '01:02:03:04:05:06',
        internal: false,
        cidr: 'fe80::1234:5678:9abc:def0/64',
        scopeid: 1, // Example scopeid
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Mock os.networkInterfaces() - No need for 'as any' if mock data is correct
    vi.mocked(os.networkInterfaces).mockReturnValue(mockInterfaces);
  });

  it('should get network interfaces successfully', async () => {
    const args: GetInterfacesToolInput = { id: 'b' }; // Rename to args
    const parts = await getInterfacesTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<GetInterfacesResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
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

    const args: GetInterfacesToolInput = { id: 'h' }; // Rename to args
    const parts = await getInterfacesTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<GetInterfacesResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toBe(mockError.message); // Error comes directly from the catch block
    expect(itemResult.suggestion).toBe(
      'Check system permissions or if network interfaces are available.',
    );
  });
});
