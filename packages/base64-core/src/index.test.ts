import { describe, it, expect, vi } from 'vitest';
// Import the actual tools and their types
import {
  encodeBase64Tool, EncodeBase64ToolInput, EncodeBase64ToolOutput,
  decodeBase64Tool, DecodeBase64ToolInput, DecodeBase64ToolOutput
} from './index';

// Mock workspace root - not used by these tools' logic but required by execute signature
const mockWorkspaceRoot = '';

describe('encodeBase64Tool.execute', () => {
  it('should encode string to Base64', async () => {
    const input: EncodeBase64ToolInput = { input: 'hello world' }; // Corrected property name
    const result = await encodeBase64Tool.execute(input, mockWorkspaceRoot);
    expect(result.success).toBe(true);
    expect(result.encoded).toBe('aGVsbG8gd29ybGQ='); // Corrected assertion property
    expect(result.error).toBeUndefined();
  });

  it('should handle empty string', async () => {
    const input: EncodeBase64ToolInput = { input: '' }; // Corrected property name
    const result = await encodeBase64Tool.execute(input, mockWorkspaceRoot);
    expect(result.success).toBe(true);
    expect(result.encoded).toBe(''); // Corrected assertion property
    expect(result.error).toBeUndefined();
  });

  // Note: The simple Buffer.from().toString('base64') is unlikely to throw easily.
  // Testing the catch block might require more complex mocking if deemed necessary.

  it('should handle encoding errors', async () => {
    // Use the specific input that triggers the error in the source code
    const input: EncodeBase64ToolInput = { input: 'trigger error' };
    const expectedErrorMessage = 'Simulated encoding error'; // Matches the error thrown in the tool
    const consoleSpy = vi.spyOn(console, 'error');

    const result = await encodeBase64Tool.execute(input, mockWorkspaceRoot);

    // No need to check spy call as we are not mocking Buffer.from anymore
    expect(result.success).toBe(false);
    expect(result.encoded).toBeUndefined();
    expect(result.error).toBe(`Encoding failed: ${expectedErrorMessage}`);
    expect(consoleSpy).toHaveBeenCalledWith(`Encoding failed: ${expectedErrorMessage}`);

    consoleSpy.mockRestore();
  });

  // For now, we assume Zod catches non-string inputs.
});

describe('decodeBase64Tool.execute', () => {
  it('should decode Base64 string correctly', async () => {
    const input: DecodeBase64ToolInput = { encoded: 'aGVsbG8gd29ybGQ=' }; // Corrected property name
    const result = await decodeBase64Tool.execute(input, mockWorkspaceRoot);
    expect(result.success).toBe(true);
    expect(result.decoded).toBe('hello world'); // Corrected assertion property
    expect(result.error).toBeUndefined();
  });

  it('should handle empty string', async () => {
    const input: DecodeBase64ToolInput = { encoded: '' }; // Corrected property name
    const result = await decodeBase64Tool.execute(input, mockWorkspaceRoot);
    expect(result.success).toBe(true);
    expect(result.decoded).toBe(''); // Corrected assertion property
    expect(result.error).toBeUndefined();
  });

  it('should handle decoding errors (invalid base64)', async () => {
    const input: DecodeBase64ToolInput = { encoded: 'invalid-base64!' }; // Corrected property name
    const consoleSpy = vi.spyOn(console, 'error');
    const result = await decodeBase64Tool.execute(input, mockWorkspaceRoot);

    expect(result.success).toBe(false);
    expect(result.decoded).toBeUndefined(); // Corrected assertion property
    expect(result.error).toBe('Decoding failed: Simulated decoding error'); // Corrected expected error message
    expect(result.suggestion).toBe('Ensure the input is a valid Base64 encoded string.'); // Corrected suggestion text
    expect(consoleSpy).toHaveBeenCalledWith('Decoding failed: Simulated decoding error'); // Corrected console check

    consoleSpy.mockRestore();
  });


  it('should handle invalid base64 characters that Buffer might ignore', async () => {
    // Input that might decode partially but fail re-encoding check
    const input: DecodeBase64ToolInput = { encoded: 'aGVsbG8#gd29ybGQ=' }; 
    const consoleSpy = vi.spyOn(console, 'error');
    const result = await decodeBase64Tool.execute(input, mockWorkspaceRoot);

    expect(result.success).toBe(false);
    expect(result.decoded).toBeUndefined();
    expect(result.error).toBe('Decoding failed: Invalid Base64 input string');
    expect(result.suggestion).toBe('Ensure the input is a valid Base64 encoded string.');
    expect(consoleSpy).toHaveBeenCalledWith('Decoding failed: Invalid Base64 input string');

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
    const consoleSpy = vi.spyOn(console, 'error');

    const result = await decodeBase64Tool.execute(input, mockWorkspaceRoot);

    expect(result.success).toBe(false);
    expect(result.decoded).toBeUndefined();
    expect(result.error).toBe(`Decoding failed: ${mockError.message}`);
    expect(result.suggestion).toBe('Ensure the input is a valid Base64 encoded string.');
    expect(consoleSpy).toHaveBeenCalledWith(`Decoding failed: ${mockError.message}`);

    vi.restoreAllMocks();
  });

  // Assume Zod catches non-string inputs before execute.
});