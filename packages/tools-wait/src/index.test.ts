import type { Part, ToolExecuteOptions } from '@sylphlab/tools-core'; // Import Part type and ToolExecuteOptions
import { describe, expect, it, vi } from 'vitest';
// Import the actual tool and its input type
import { type WaitToolInput, waitTool } from './index.js';
import type { WaitResultItem } from './tools/waitTool.js'; // Import result type
import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

// Mock workspace root - not used by waitTool's logic but required by execute signature
const mockContext: ToolExecuteOptions = { workspaceRoot: '' }; // Use mock context

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
describe('waitTool.execute', () => {
  it('should resolve after the specified time (single item batch)', async () => {
    const startTime = Date.now();
    const waitTime = 50; // Use a small wait time for the test
    const args: WaitToolInput = { items: [{ id: 'wait1', durationMs: waitTime }] }; // Rename to args
    const consoleSpy = vi.spyOn(console, 'log');

    const parts = await waitTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WaitResultItem>(parts); // Specify generic type

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(results).toBeDefined();
    if (!results) throw new Error('Test setup error: results should be defined'); // Type guard
    expect(results).toHaveLength(1);
    const itemResult = results[0]; // No non-null assertion needed
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
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
    const args: WaitToolInput = { items: [{ id: 'wait0', durationMs: 0 }] }; // Rename to args
    const parts = await waitTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WaitResultItem>(parts); // Specify generic type

    expect(results).toBeDefined();
    if (!results) throw new Error('Test setup error: results should be defined'); // Type guard
    expect(results).toHaveLength(1);
    const itemResult = results[0]; // No non-null assertion needed
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('wait0');
    expect(itemResult.durationWaitedMs).toBe(0);
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle errors during the wait operation (single item batch)', async () => {
    // This tests the unlikely scenario where the setTimeout promise itself rejects
    const args: WaitToolInput = { items: [{ id: 'wait_err', durationMs: 10 }] }; // Rename to args
    const mockError = new Error('Internal timer error');

    // Mock setTimeout to throw an error
    const _originalSetTimeout = global.setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementationOnce(() => {
      throw mockError;
    });

    const parts = await waitTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WaitResultItem>(parts); // Specify generic type

    expect(results).toBeDefined();
    if (!results) throw new Error('Test setup error: results should be defined'); // Type guard
    expect(results).toHaveLength(1);
    const itemResult = results[0]; // No non-null assertion needed
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
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
    const args: WaitToolInput = { // Rename to args
      items: [
        { id: 'batch_wait1', durationMs: waitTime1 },
        { id: 'batch_wait2', durationMs: waitTime2 },
      ],
    };
    const startTime = Date.now();
    const consoleSpy = vi.spyOn(console, 'log');

    const parts = await waitTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WaitResultItem>(parts); // Specify generic type

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const expectedTotalWait = waitTime1 + waitTime2;

    expect(results).toBeDefined();
    if (!results) throw new Error('Test setup error: results should be defined'); // Type guard
    expect(results).toHaveLength(2);

    // Check first item
    const itemResult1 = results[0]; // No non-null assertion needed
    expect(itemResult1).toBeDefined(); // Add check
    if (!itemResult1) return; // Type guard
    expect(itemResult1.success).toBe(true);
    expect(itemResult1.id).toBe('batch_wait1');
    expect(itemResult1.durationWaitedMs).toBe(waitTime1);
    expect(itemResult1.error).toBeUndefined();

    // Check second item
    const itemResult2 = results[1]; // No non-null assertion needed
    expect(itemResult2).toBeDefined(); // Add check
    if (!itemResult2) return; // Type guard
    expect(itemResult2.success).toBe(true);
    expect(itemResult2.id).toBe('batch_wait2');
    expect(itemResult2.durationWaitedMs).toBe(waitTime2);
    expect(itemResult2.error).toBeUndefined();

    // Check timing (approximate)
    expect(totalDuration).toBeGreaterThanOrEqual(expectedTotalWait - 15); // Allow tolerance
    expect(totalDuration).toBeLessThan(expectedTotalWait + 350); // Allow generous upper bound (increased from 250)

    consoleSpy.mockRestore();
  });
});
