import type { Part } from '@sylphlab/mcp-core'; // Import Part type
import { describe, expect, it, vi } from 'vitest';
// Import the actual tool and its input type
import { type WaitToolInput, waitTool } from './index.js';
import type { WaitResultItem } from './tools/waitTool.js'; // Import result type

// Mock workspace root - not used by waitTool's logic but required by execute signature
const mockWorkspaceRoot = '';

// Helper to extract JSON result from parts
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
describe('waitTool.execute', () => {
  it('should resolve after the specified time (single item batch)', async () => {
    const startTime = Date.now();
    const waitTime = 50; // Use a small wait time for the test
    const input: WaitToolInput = { items: [{ id: 'wait1', durationMs: waitTime }] };
    const consoleSpy = vi.spyOn(console, 'log');

    const parts = await waitTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('wait1');
    expect(itemResult.durationWaitedMs).toBe(waitTime);
    expect(itemResult.error).toBeUndefined();

    // Check timing
    expect(duration).toBeGreaterThanOrEqual(waitTime - 10); // Allow some tolerance
    expect(duration).toBeLessThan(waitTime + 100); // Allow generous upper bound

    consoleSpy.mockRestore();
  });

  it('should handle zero wait time (single item batch)', async () => {
    const input: WaitToolInput = { items: [{ id: 'wait0', durationMs: 0 }] };
    const parts = await waitTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('wait0');
    expect(itemResult.durationWaitedMs).toBe(0);
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle errors during the wait operation (single item batch)', async () => {
    // This tests the unlikely scenario where the setTimeout promise itself rejects
    const input: WaitToolInput = { items: [{ id: 'wait_err', durationMs: 10 }] };
    const mockError = new Error('Internal timer error');

    // Mock setTimeout to throw an error
    const _originalSetTimeout = global.setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementationOnce(() => {
      throw mockError;
    });

    const parts = await waitTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('wait_err');
    expect(itemResult.durationWaitedMs).toBeUndefined();
    expect(itemResult.error).toBe(`Wait failed: ${mockError.message}`);

    // Restore mocks
    vi.restoreAllMocks();
  });

  it('should process a batch of wait operations sequentially', async () => {
    const waitTime1 = 30;
    const waitTime2 = 20;
    const input: WaitToolInput = {
      items: [
        { id: 'batch_wait1', durationMs: waitTime1 },
        { id: 'batch_wait2', durationMs: waitTime2 },
      ],
    };
    const startTime = Date.now();
    const consoleSpy = vi.spyOn(console, 'log');

    const parts = await waitTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const expectedTotalWait = waitTime1 + waitTime2;

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);

    // Check first item
    const itemResult1 = results?.[0];
    expect(itemResult1.success).toBe(true);
    expect(itemResult1.id).toBe('batch_wait1');
    expect(itemResult1.durationWaitedMs).toBe(waitTime1);
    expect(itemResult1.error).toBeUndefined();

    // Check second item
    const itemResult2 = results?.[1];
    expect(itemResult2.success).toBe(true);
    expect(itemResult2.id).toBe('batch_wait2');
    expect(itemResult2.durationWaitedMs).toBe(waitTime2);
    expect(itemResult2.error).toBeUndefined();

    // Check timing (approximate)
    expect(totalDuration).toBeGreaterThanOrEqual(expectedTotalWait - 15); // Allow tolerance
    expect(totalDuration).toBeLessThan(expectedTotalWait + 150); // Allow generous upper bound

    consoleSpy.mockRestore();
  });
});
