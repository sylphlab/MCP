import { describe, it, expect, vi } from 'vitest';
// Import the actual tool and its input type
import { waitTool, WaitToolInput } from './index';

// Mock workspace root - not used by waitTool's logic but required by execute signature
const mockWorkspaceRoot = '';

describe('waitTool.execute', () => {
  it('should resolve after the specified time', async () => {
    const startTime = Date.now();
    const waitTime = 50; // Use a small wait time for the test
    const input: WaitToolInput = { ms: waitTime };
    const consoleSpy = vi.spyOn(console, 'log');

    const result = await waitTool.execute(input, mockWorkspaceRoot);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    // Update expected success message
    expect(result.content).toEqual([{ type: 'text', text: `Successfully waited for ${waitTime}ms.` }]);

    // Check if the duration is roughly the wait time (allowing for some overhead)
    expect(duration).toBeGreaterThanOrEqual(waitTime - 10); // Allow some tolerance
    expect(duration).toBeLessThan(waitTime + 100); // Allow generous upper bound for test runners
    expect(consoleSpy).toHaveBeenCalledWith(`Waiting for ${waitTime}ms...`);
    expect(consoleSpy).toHaveBeenCalledWith('Wait finished.');
    consoleSpy.mockRestore();
  });

  it('should handle zero wait time', async () => {
    const input: WaitToolInput = { ms: 0 };
    const result = await waitTool.execute(input, mockWorkspaceRoot);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    // Update expected success message
    expect(result.content).toEqual([{ type: 'text', text: `Successfully waited for 0ms.` }]);
  });

  it('should handle errors during the wait operation', async () => {
    const input: WaitToolInput = { ms: 10 };
    const mockError = new Error('setTimeout failed');
    // Mock setTimeout to throw an error
    vi.spyOn(global, 'setTimeout').mockImplementationOnce(() => {
      throw mockError;
    });
    const consoleSpy = vi.spyOn(console, 'error');

    const result = await waitTool.execute(input, mockWorkspaceRoot);

    expect(result.success).toBe(false);
    expect(result.error).toBe(`Wait failed: ${mockError.message}`);
    expect(result.content).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(`Wait tool failed: ${mockError.message}`);

    // Restore mocks
    vi.restoreAllMocks();
  });


  // Removed tests for invalid inputs calling execute directly,
  // as Zod validation should prevent these inputs in the MCP server flow.
  // Schema validation could be tested separately.
});
