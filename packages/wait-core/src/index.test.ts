import { describe, expect, it, vi } from 'vitest';
// Import the actual tool and its input type
import { type WaitToolInput, waitTool } from './index.js';

// Mock workspace root - not used by waitTool's logic but required by execute signature
const mockWorkspaceRoot = '';

describe('waitTool.execute', () => {
  it('should resolve after the specified time (single item batch)', async () => {
    const startTime = Date.now();
    const waitTime = 50; // Use a small wait time for the test
    const input: WaitToolInput = { items: [{ id: 'wait1', durationMs: waitTime }] }; // Use durationMs
    const consoleSpy = vi.spyOn(console, 'log');

    const result = await waitTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.results).toHaveLength(1);
    const itemResult = result.results[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('wait1');
    expect(itemResult.durationWaitedMs).toBe(waitTime);
    expect(itemResult.error).toBeUndefined();

    expect(result.totalDurationWaitedMs).toBe(waitTime);
    const expectedContent = JSON.stringify(
      {
        summary: `Processed 1 wait operations. Total duration waited: ${waitTime}ms. Overall success: true`,
        totalDurationWaitedMs: waitTime,
        results: [{ id: 'wait1', success: true, durationWaitedMs: waitTime }],
      },
      null,
      2,
    );
    expect(result.content).toEqual([{ type: 'text', text: expectedContent }]);

    // Check if the duration is roughly the wait time (allowing for some overhead)
    expect(duration).toBeGreaterThanOrEqual(waitTime - 10); // Allow some tolerance
    expect(duration).toBeLessThan(waitTime + 100); // Allow generous upper bound for test runners
    consoleSpy.mockRestore();
  });

  it('should handle zero wait time (single item batch)', async () => {
    const input: WaitToolInput = { items: [{ id: 'wait0', durationMs: 0 }] }; // Use durationMs
    const result = await waitTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.results).toHaveLength(1);
    const itemResult = result.results[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('wait0');
    expect(itemResult.durationWaitedMs).toBe(0);
    expect(itemResult.error).toBeUndefined();

    expect(result.totalDurationWaitedMs).toBe(0);
    const expectedContentZero = JSON.stringify(
      {
        summary: 'Processed 1 wait operations. Total duration waited: 0ms. Overall success: true',
        totalDurationWaitedMs: 0,
        results: [{ id: 'wait0', success: true, durationWaitedMs: 0 }],
      },
      null,
      2,
    );
    expect(result.content).toEqual([{ type: 'text', text: expectedContentZero }]);
  });

  it('should handle errors during the wait operation (single item batch)', async () => {
    // This tests the unlikely scenario where the setTimeout promise itself rejects
    const input: WaitToolInput = { items: [{ id: 'wait_err', durationMs: 10 }] }; // Use durationMs
    const mockError = new Error('Internal timer error');

    // Mock the Promise constructor or setTimeout behavior to simulate rejection
    const _originalSetTimeout = global.setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementationOnce((_callback, _ms) => {
      // Simulate an error occurring *before* the timeout completes
      // In a real scenario, this is very unlikely for setTimeout itself.
      // We're testing the catch block in processSingleWait.
      throw mockError;
      // return originalSetTimeout(callback, ms); // Keep TypeScript happy
    });

    const _consoleErrSpy = vi.spyOn(console, 'error');

    const result = await waitTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(false); // Overall fails
    expect(result.error).toBeUndefined(); // No *tool* level error
    expect(result.results).toHaveLength(1);
    const itemResult = result.results[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('wait_err');
    expect(itemResult.durationWaitedMs).toBeUndefined();
    expect(itemResult.error).toBe(`Wait failed: ${mockError.message}`);

    expect(result.totalDurationWaitedMs).toBe(0); // Failed wait doesn't add to total
    const expectedContentError = JSON.stringify(
      {
        summary: 'Processed 1 wait operations. Total duration waited: 0ms. Overall success: false',
        totalDurationWaitedMs: 0,
        results: [{ id: 'wait_err', success: false, error: `Wait failed: ${mockError.message}` }],
      },
      null,
      2,
    );
    expect(result.content).toEqual([{ type: 'text', text: expectedContentError }]);

    // Restore mocks
    vi.restoreAllMocks();
  });

  it('should process a batch of wait operations sequentially', async () => {
    const waitTime1 = 30;
    const waitTime2 = 20;
    const input: WaitToolInput = {
      items: [
        { id: 'batch_wait1', durationMs: waitTime1 }, // Use durationMs
        { id: 'batch_wait2', durationMs: waitTime2 }, // Use durationMs
      ],
    };
    const startTime = Date.now();
    const consoleSpy = vi.spyOn(console, 'log');

    const result = await waitTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const expectedTotalWait = waitTime1 + waitTime2;

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.results).toHaveLength(2);

    // Check first item
    const itemResult1 = result.results[0];
    expect(itemResult1.success).toBe(true);
    expect(itemResult1.id).toBe('batch_wait1');
    expect(itemResult1.durationWaitedMs).toBe(waitTime1);
    expect(itemResult1.error).toBeUndefined();

    // Check second item
    const itemResult2 = result.results[1];
    expect(itemResult2.success).toBe(true);
    expect(itemResult2.id).toBe('batch_wait2');
    expect(itemResult2.durationWaitedMs).toBe(waitTime2);
    expect(itemResult2.error).toBeUndefined();

    // Check overall results
    expect(result.totalDurationWaitedMs).toBe(expectedTotalWait);
    const expectedContentBatch = JSON.stringify(
      {
        summary: `Processed 2 wait operations. Total duration waited: ${expectedTotalWait}ms. Overall success: true`,
        totalDurationWaitedMs: expectedTotalWait,
        results: [
          { id: 'batch_wait1', success: true, durationWaitedMs: waitTime1 },
          { id: 'batch_wait2', success: true, durationWaitedMs: waitTime2 },
        ],
      },
      null,
      2,
    );
    expect(result.content).toEqual([{ type: 'text', text: expectedContentBatch }]);

    // Check timing (approximate)
    expect(totalDuration).toBeGreaterThanOrEqual(expectedTotalWait - 15); // Allow tolerance
    expect(totalDuration).toBeLessThan(expectedTotalWait + 150); // Allow generous upper bound

    consoleSpy.mockRestore();
  });

  // Removed tests for invalid inputs calling execute directly,
  // as Zod validation should prevent these inputs in the MCP server flow.
  // Schema validation could be tested separately.
});
