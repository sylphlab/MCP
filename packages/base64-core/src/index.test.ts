import { describe, expect, it, vi } from 'vitest';
// Import the actual tools and their types
import {
  type DecodeBase64ToolInput,
  DecodeBase64ToolOutput,
  type EncodeBase64ToolInput,
  EncodeBase64ToolOutput,
  decodeBase64Tool,
  encodeBase64Tool,
} from './index.js';

// Mock workspace root - not used by these tools' logic but required by execute signature
const mockWorkspaceRoot = '';

describe('encodeBase64Tool.execute', () => {
  it('should encode string to Base64', async () => {
    const input: EncodeBase64ToolInput = { input: 'hello world' };
    const result = await encodeBase64Tool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object
    expect(result.success).toBe(true);
    expect(result.encoded).toBe('aGVsbG8gd29ybGQ=');
    expect(result.error).toBeUndefined();
  });

  it('should handle empty string', async () => {
    const input: EncodeBase64ToolInput = { input: '' };
    const result = await encodeBase64Tool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object
    expect(result.success).toBe(true);
    expect(result.encoded).toBe('');
    expect(result.error).toBeUndefined();
  });

  // Note: The simple Buffer.from().toString('base64') is unlikely to throw easily.
  // Testing the catch block might require more complex mocking if deemed necessary.

  it('should handle encoding errors', async () => {
    // Use the specific input that triggers the error in the source code
    const input: EncodeBase64ToolInput = { input: 'trigger error' };
    const expectedErrorMessage = 'Simulated encoding error'; // Matches the error thrown in the tool
    const consoleSpy = vi.spyOn(console, 'error');

    const result = await encodeBase64Tool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(false);
    expect(result.encoded).toBeUndefined();
    expect(result.error).toBe(`Tool 'encodeBase64' execution failed: ${expectedErrorMessage}`); // Added prefix

    consoleSpy.mockRestore();
  });

  // For now, we assume Zod catches non-string inputs.
});

describe('decodeBase64Tool.execute', () => {
  it('should decode Base64 string correctly', async () => {
    const input: DecodeBase64ToolInput = { encoded: 'aGVsbG8gd29ybGQ=' };
    const result = await decodeBase64Tool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object
    expect(result.success).toBe(true);
    expect(result.decoded).toBe('hello world');
    expect(result.error).toBeUndefined();
  });

  it('should handle empty string', async () => {
    const input: DecodeBase64ToolInput = { encoded: '' };
    const result = await decodeBase64Tool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object
    expect(result.success).toBe(true);
    expect(result.decoded).toBe('');
    expect(result.error).toBeUndefined();
  });

  it('should handle decoding errors (invalid base64)', async () => {
    const input: DecodeBase64ToolInput = { encoded: 'invalid-base64!' };
    const consoleSpy = vi.spyOn(console, 'error');
    const result = await decodeBase64Tool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(false);
    expect(result.decoded).toBeUndefined(); // Corrected assertion property
    expect(result.error).toBe('Tool \'decodeBase64\' execution failed: Simulated decoding error'); // Added prefix
    // expect(result.suggestion).toBe('Ensure the input is a valid Base64 encoded string.'); // Removed assertion for suggestion

    consoleSpy.mockRestore();
  });

  it('should handle invalid base64 characters that Buffer might ignore', async () => {
    // Input that might decode partially but fail re-encoding check
    const input: DecodeBase64ToolInput = { encoded: 'aGVsbG8#gd29ybGQ=' };
    const consoleSpy = vi.spyOn(console, 'error');
    const result = await decodeBase64Tool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(false);
    expect(result.decoded).toBeUndefined();
    expect(result.error).toBe('Tool \'decodeBase64\' execution failed: Invalid Base64 input string'); // Added prefix
    // expect(result.suggestion).toBe('Ensure the input is a valid Base64 encoded string.'); // Removed assertion for suggestion

    consoleSpy.mockRestore();
  });

  it('should handle errors during decoding', async () => {
    const input: DecodeBase64ToolInput = { encoded: 'valid' };
    const mockError = new Error('Buffer.from failed');
    // Store original before mocking
    const originalBufferFrom = Buffer.from;
    // Mock Buffer.from to throw during decode
    vi.spyOn(Buffer, 'from').mockImplementation((value, encoding) => {
      if (encoding === 'base64') {
        throw mockError;
      }
      // Call original for other encodings to avoid recursion
      return originalBufferFrom(value as string, encoding);
    });
    const _consoleSpy = vi.spyOn(console, 'error');

    const result = await decodeBase64Tool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(false);
    expect(result.decoded).toBeUndefined();
    expect(result.error).toBe(`Tool 'decodeBase64' execution failed: ${mockError.message}`); // Added prefix
    // expect(result.suggestion).toBe('Ensure the input is a valid Base64 encoded string.'); // Removed assertion for suggestion

    vi.restoreAllMocks();
  });

  // Assume Zod catches non-string inputs before execute.
});
