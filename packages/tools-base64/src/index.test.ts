import type { Part, ToolExecuteOptions } from '@sylphlab/tools-core'; // Import Part type and ToolExecuteOptions
import { describe, expect, it, vi } from 'vitest';
// Import the actual tools and their types
import { type DecodeBase64ToolInput, type EncodeBase64ToolInput, decodeBase64Tool, encodeBase64Tool } from './index.js'; // Removed HashToolOutput import
import type { DecodeBase64Result } from './tools/decodeBase64Tool.js'; // Import correct result type
import type { EncodeBase64Result } from './tools/encodeBase64Tool.js'; // Import correct result type

// Mock workspace root - not used by these tools' logic but required by execute signature
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

describe('encodeBase64Tool.execute', () => {
  it('should encode string to Base64', async () => {
    const args: EncodeBase64ToolInput = { input: 'hello world' }; // Rename to args
    const parts = await encodeBase64Tool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<EncodeBase64Result>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.encoded).toBe('aGVsbG8gd29ybGQ=');
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle empty string', async () => {
    const args: EncodeBase64ToolInput = { input: '' }; // Rename to args
    const parts = await encodeBase64Tool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<EncodeBase64Result>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.encoded).toBe('');
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle encoding errors', async () => {
    // Use the specific input that triggers the error in the source code
    const args: EncodeBase64ToolInput = { input: 'trigger error' }; // Rename to args
    const expectedErrorMessage = 'Simulated encoding error';
    const consoleSpy = vi.spyOn(console, 'error');

    const parts = await encodeBase64Tool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<EncodeBase64Result>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.encoded).toBeUndefined();
    // The error is now within the item result, not wrapped by defineTool prefix
    expect(itemResult.error).toBe(expectedErrorMessage);

    consoleSpy.mockRestore();
  });
});

describe('decodeBase64Tool.execute', () => {
  it('should decode Base64 string correctly', async () => {
    const args: DecodeBase64ToolInput = { encoded: 'aGVsbG8gd29ybGQ=' }; // Rename to args
    const parts = await decodeBase64Tool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<DecodeBase64Result>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.decoded).toBe('hello world');
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle empty string', async () => {
    const args: DecodeBase64ToolInput = { encoded: '' }; // Rename to args
    const parts = await decodeBase64Tool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<DecodeBase64Result>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.decoded).toBe('');
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle decoding errors (simulated)', async () => {
    const args: DecodeBase64ToolInput = { encoded: 'invalid-base64!' }; // Rename to args
    const consoleSpy = vi.spyOn(console, 'error');
    const parts = await decodeBase64Tool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<DecodeBase64Result>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.decoded).toBeUndefined();
    expect(itemResult.error).toBe('Simulated decoding error');

    consoleSpy.mockRestore();
  });

  it('should handle invalid base64 characters that Buffer might ignore', async () => {
    const args: DecodeBase64ToolInput = { encoded: 'aGVsbG8#gd29ybGQ=' }; // Rename to args
    const consoleSpy = vi.spyOn(console, 'error');
    const parts = await decodeBase64Tool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<DecodeBase64Result>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.decoded).toBeUndefined();
    expect(itemResult.error).toBe('Invalid Base64 input string');

    consoleSpy.mockRestore();
  });

  it('should handle errors during decoding (mocked Buffer.from)', async () => {
    const args: DecodeBase64ToolInput = { encoded: 'valid' }; // Rename to args
    const mockError = new Error('Buffer.from failed');
    const originalBufferFrom = Buffer.from;
    vi.spyOn(Buffer, 'from').mockImplementation((value, encoding) => {
      if (encoding === 'base64') {
        throw mockError;
      }
      return originalBufferFrom(value as string, encoding);
    });

    const parts = await decodeBase64Tool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<DecodeBase64Result>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.decoded).toBeUndefined();
    expect(itemResult.error).toBe(mockError.message); // Error comes directly from the catch block

    vi.restoreAllMocks();
  });
});
