import { describe, it, expect, vi } from 'vitest';
import { wait } from './index';

describe('wait function', () => {
  it('should resolve after the specified time', async () => {
    const startTime = Date.now();
    const waitTime = 50; // Use a small wait time for the test
    const consoleSpy = vi.spyOn(console, 'log');

    await expect(wait(waitTime)).resolves.toBeUndefined(); // Check it resolves successfully

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Check if the duration is roughly the wait time (allowing for some overhead)
    expect(duration).toBeGreaterThanOrEqual(waitTime - 10); // Allow some tolerance
    expect(duration).toBeLessThan(waitTime + 100); // Allow generous upper bound for test runners
    expect(consoleSpy).toHaveBeenCalledWith(`Waiting for ${waitTime}ms...`);
    expect(consoleSpy).toHaveBeenCalledWith('Wait finished.');
    consoleSpy.mockRestore();
  });

  it('should handle zero wait time', async () => {
    await expect(wait(0)).resolves.toBeUndefined();
  });

  it('should handle negative wait time gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    await expect(wait(-10)).resolves.toBeUndefined(); // Should return immediately
    expect(consoleSpy).toHaveBeenCalledWith('Invalid duration provided to wait function.');
    consoleSpy.mockRestore();
  });

   it('should handle non-number wait time gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    // Need to cast to any to bypass TypeScript check during test writing
    await expect(wait('abc' as any)).resolves.toBeUndefined(); // Should return immediately
    expect(consoleSpy).toHaveBeenCalledWith('Invalid duration provided to wait function.');
    consoleSpy.mockRestore();
  });
});
