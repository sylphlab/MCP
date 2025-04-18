import { describe, it, expect } from 'vitest';
import { wait } from './index'; // Assuming wait is exported from index.ts

describe('wait function', () => {
  it('should resolve after the specified time', async () => {
    const startTime = Date.now();
    const waitTime = 50; // Use a small wait time for the test

    await expect(wait(waitTime)).resolves.toBeUndefined(); // Check it resolves successfully

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Check if the duration is roughly the wait time (allowing for some overhead)
    expect(duration).toBeGreaterThanOrEqual(waitTime - 10); // Allow some tolerance
    expect(duration).toBeLessThan(waitTime + 100); // Allow generous upper bound for test runners
  });

  it('should handle zero wait time', async () => {
    await expect(wait(0)).resolves.toBeUndefined();
  });
});
