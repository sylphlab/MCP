import os from 'node:os'; // Import os for mocking
import type { McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import individual tools and types
import {
  type GetInterfacesToolInput,
  GetInterfacesToolOutput,
  type GetPublicIpToolInput,
  GetPublicIpToolOutput,
  getInterfacesTool,
  getPublicIpTool,
} from './index.js'; // Added .js extension

// Mock the os module for getInterfaces
vi.mock('node:os');

// Mock workspace root - not used by these tools' logic but required by execute signature
const mockWorkspaceRoot = '';
// Define options objects including workspaceRoot
const defaultOptions: McpToolExecuteOptions = { workspaceRoot: mockWorkspaceRoot };

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
    const input: GetPublicIpToolInput = { id: 'a' }; // Input might just be an ID or empty
    const result = await getPublicIpTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.result).toBe('8.8.8.8'); // Correct property name
    expect(result.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://ipinfo.io/json'); // Correct URL
  });

  it('should handle public IP fetch error', async () => {
    // Mock fetch to fail
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response);

    const input: GetPublicIpToolInput = { id: 'd' };
    const result = await getPublicIpTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.result).toBeUndefined(); // Correct property name
    // Update expected error to include fallback details
    expect(result.error).toBe(
      'Tool \'getPublicIp\' execution failed: Failed to fetch public IP: HTTP error! status: 500. Fallback also failed: Fallback failed: Fallback HTTP error! status: 500', // Added prefix
    );
  });

  it('should handle network error during public IP fetch', async () => {
    // Mock fetch to throw a network error
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network failed'));

    const input: GetPublicIpToolInput = { id: 'g' };
    const result = await getPublicIpTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.ip).toBeUndefined();
    expect(result.error).toContain('Failed to fetch public IP: Network failed');
  });

  // Note: Caching logic is internal to the tool, testing multiple calls implicitly tests caching if implemented
});

describe('getInterfacesTool.execute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock os.networkInterfaces()
    vi.mocked(os.networkInterfaces).mockReturnValue({
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
    });
  });

  it('should get network interfaces successfully', async () => {
    const input: GetInterfacesToolInput = { id: 'b' }; // Input might just be an ID or empty
    const result = await getInterfacesTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined(); // Correct property name
    expect(result.result?.eth0).toBeDefined(); // Correct property name
    expect(result.result?.eth0?.[0]?.address).toBe('192.168.1.100'); // Correct property name
    expect(result.error).toBeUndefined();
    expect(os.networkInterfaces).toHaveBeenCalledTimes(1);
  });

  it('should handle errors from os.networkInterfaces', async () => {
    const mockError = new Error('OS Error');
    vi.mocked(os.networkInterfaces).mockImplementation(() => {
      throw mockError;
    });

    const input: GetInterfacesToolInput = { id: 'h' };
    const result = await getInterfacesTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.result).toBeUndefined(); // Correct property name
    expect(result.error).toBe(`Tool 'getInterfaces' execution failed: ${mockError.message}`); // Added prefix
  });
});
