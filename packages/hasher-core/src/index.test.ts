import { describe, it, expect } from 'vitest';
// Import the actual tool and its types
import { hashTool, HashToolInput, HashToolOutput } from './index';

// Mock workspace root - not used by hashTool's logic but required by execute signature
const mockWorkspaceRoot = '';

describe('hashTool.execute', () => {
  it('should compute sha256 hash correctly', async () => {
    const item: HashToolInput = { id: 'a', algorithm: 'sha256', data: 'hello world' };
    const result = await hashTool.execute(item, mockWorkspaceRoot);
    expect(result.success).toBe(true);
    expect(result.id).toBe('a');
    expect(result.result).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    expect(result.error).toBeUndefined();
  });

  it('should compute md5 hash correctly', async () => {
    const item: HashToolInput = { id: 'b', algorithm: 'md5', data: 'hello world' };
    const result = await hashTool.execute(item, mockWorkspaceRoot);
    expect(result.success).toBe(true);
    expect(result.id).toBe('b');
    expect(result.result).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3'); // md5 hash of 'hello world'
    expect(result.error).toBeUndefined();
  });

  it('should handle empty string', async () => {
    const item: HashToolInput = { id: 'c', algorithm: 'sha256', data: '' };
    const result = await hashTool.execute(item, mockWorkspaceRoot);
    expect(result.success).toBe(true);
    expect(result.id).toBe('c');
    expect(result.result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(result.error).toBeUndefined();
  });

  it('should return error for unsupported algorithm', async () => {
    // Zod validation should catch this before execute, but test execute's catch block just in case
    // We bypass Zod by casting algorithm to any for this test purpose
    const item: HashToolInput = { id: 'd', algorithm: 'invalidAlgo' as any, data: 'test' };
    const result = await hashTool.execute(item, mockWorkspaceRoot);
    expect(result.success).toBe(false);
    expect(result.id).toBe('d');
    expect(result.result).toBeUndefined();
    expect(result.error).toContain('Hash operation failed: Digest method not supported'); // Error from crypto.createHash
    expect(result.suggestion).toBe('Check algorithm name and input data type.');
  });

  it('should return error for non-string data (if Zod bypassed)', async () => {
    // Zod validation should catch this before execute. This tests the internal logic robustness.
    // We bypass Zod by casting data to any for this test purpose
    const item: HashToolInput = { id: 'e', algorithm: 'sha256', data: 123 as any };
    // Note: The actual 'crypto' module might throw differently or coerce.
    // The schema prevents this, but we test the tool's direct call robustness.
    // The current implementation relies on Zod; a direct call would likely fail in createHash.
    // Let's assume Zod is bypassed and test the expected outcome if crypto fails.
    // Depending on Node version, crypto might throw. We expect the catch block.
    const result = await hashTool.execute(item, mockWorkspaceRoot);
    expect(result.success).toBe(false);
    expect(result.id).toBe('e');
    expect(result.result).toBeUndefined();
    // The error message might vary based on Node's crypto implementation details
    expect(result.error).toContain('Hash operation failed:');
    expect(result.suggestion).toBe('Check algorithm name and input data type.');

  });

  it('should process multiple items when called sequentially/parallelly', async () => {
    const items: HashToolInput[] = [
      { id: 'f', algorithm: 'sha256', data: 'abc' },
      { id: 'g', algorithm: 'md5', data: 'def' },
      { id: 'h', algorithm: 'sha512', data: 'ghi' },
      { id: 'i', algorithm: 'bad' as any, data: 'test' }, // Error case
    ];

    // Execute calls in parallel
    const promises = items.map(item => hashTool.execute(item, mockWorkspaceRoot));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(4);

    // Check success cases
    const resultF = results.find(r => r.id === 'f');
    expect(resultF?.success).toBe(true);
    expect(resultF?.result).toEqual(expect.any(String)); // sha256('abc')

    const resultG = results.find(r => r.id === 'g');
    expect(resultG?.success).toBe(true);
    expect(resultG?.result).toEqual(expect.any(String)); // md5('def')

    const resultH = results.find(r => r.id === 'h');
    expect(resultH?.success).toBe(true);
    expect(resultH?.result).toEqual(expect.any(String)); // sha512('ghi')

    // Check error case
    const resultI = results.find(r => r.id === 'i');
    expect(resultI?.success).toBe(false);
    expect(resultI?.error).toContain('Hash operation failed: Digest method not supported');
  });
});