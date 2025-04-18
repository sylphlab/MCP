import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processNetOperations, NetInputItem, NetResultItem } from './index';
import os from 'node:os'; // Import os for mocking

// Mock the os module for getInterfaces
vi.mock('node:os');

describe('processNetOperations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock os.networkInterfaces()
    vi.mocked(os.networkInterfaces).mockReturnValue({
      'lo': [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' }],
      'eth0': [{ address: '192.168.1.100', netmask: '255.255.255.0', family: 'IPv4', mac: '01:02:03:04:05:06', internal: false, cidr: '192.168.1.100/24' }]
    });
    // Mock fetch for getPublicIp (simulate success)
    // In a real scenario, consider mocking 'node-fetch' or using MSW
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ip: '8.8.8.8' }),
    } as Response);
  });

  it('should process multiple operations successfully', async () => {
    const items: NetInputItem[] = [
      { id: 'a', operation: 'getPublicIp' },
      { id: 'b', operation: 'getInterfaces' },
    ];
    const results = await processNetOperations(items);

    expect(results).toHaveLength(2);
    // Check Public IP result
    expect(results[0]).toEqual(expect.objectContaining({ id: 'a', success: true, result: '8.8.8.8' }));
    // Check Interfaces result (basic check)
    expect(results[1]).toEqual(expect.objectContaining({ id: 'b', success: true }));
    expect(results[1].result?.['eth0']).toBeDefined();
    expect(global.fetch).toHaveBeenCalledTimes(1); // Public IP fetched once
  });

  it('should handle unsupported operation', async () => {
    const items: NetInputItem[] = [
      { id: 'c', operation: 'invalidOp' as any }, // Cast to bypass type check for test
    ];
    const results = await processNetOperations(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'c',
      success: false,
      error: expect.stringContaining("Unsupported network operation: invalidOp"),
    }));
  });

  it('should handle public IP fetch error', async () => {
     // Mock fetch to fail
     vi.mocked(global.fetch).mockResolvedValue({
       ok: false,
       status: 500,
     } as Response);

    const items: NetInputItem[] = [ { id: 'd', operation: 'getPublicIp' } ];
    const results = await processNetOperations(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'd',
      success: false,
      error: expect.stringContaining("Operation 'getPublicIp' failed: Failed to fetch public IP"),
    }));
  });

   it('should return previously fetched public IP for subsequent requests', async () => {
    const items: NetInputItem[] = [
      { id: 'e', operation: 'getPublicIp' },
      { id: 'f', operation: 'getPublicIp' },
    ];
    const results = await processNetOperations(items);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ id: 'e', success: true, result: '8.8.8.8' }));
    expect(results[1]).toEqual(expect.objectContaining({ id: 'f', success: true, result: '8.8.8.8' }));
    expect(global.fetch).toHaveBeenCalledTimes(1); // Still fetched only once
  });

});