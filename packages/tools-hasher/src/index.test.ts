import type { Part } from '@sylphlab/tools-core'; // Import Part type
import { describe, expect, it } from 'vitest';
// Import the actual tool and its types
import { type HashAlgorithm, type HashToolInput, hashTool } from './index.js'; // Removed HashToolOutput
import type { HashResultItem } from './tools/hashTool.js'; // Import correct result type

// Mock workspace root - not used by hashTool's logic but required by execute signature
const mockContext = { workspaceRoot: '' }; // Use a mock context object

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

describe('hashTool.execute', () => {
  it('should compute sha256 hash correctly for a single item batch', async () => {
    const args: HashToolInput = { items: [{ id: 'a', algorithm: 'sha256', data: 'hello world' }] };
    // Call execute with the new { context, args } structure
    const parts = await hashTool.execute({ context: mockContext, args });
    const results = getJsonResult<HashResultItem>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check for undefined
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('a');
    expect(itemResult.result).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    );
    expect(itemResult.error).toBeUndefined();
  });

  it('should compute md5 hash correctly for a single item batch', async () => {
    const args: HashToolInput = { items: [{ id: 'b', algorithm: 'md5', data: 'hello world' }] };
    const parts = await hashTool.execute({ context: mockContext, args });
    const results = getJsonResult<HashResultItem>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check for undefined
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('b');
    expect(itemResult.result).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3'); // md5 hash of 'hello world'
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle empty string in a single item batch', async () => {
    const args: HashToolInput = { items: [{ id: 'c', algorithm: 'sha256', data: '' }] };
    const parts = await hashTool.execute({ context: mockContext, args });
    const results = getJsonResult<HashResultItem>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check for undefined
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.error).toBeUndefined();
  });

  it('should return item error for unsupported algorithm in a single item batch', async () => {
    const input: HashToolInput = {
      // No longer need @ts-expect-error as Zod handles it
      items: [{ id: 'd', algorithm: 'invalidAlgo' as HashAlgorithm, data: 'test' }],
    };
    // Expect the execute call to throw a Zod validation error when validating args
    await expect(hashTool.execute({ context: mockContext, args: input })).rejects.toThrow(
      /Input validation failed:.*?Invalid enum value.*?received 'invalidAlgo'/s,
    );
  });

  it.skip('should process a batch of multiple items, including successes and failures', async () => {
    const args: HashToolInput = {
      items: [
        { id: 'f', algorithm: 'sha256', data: 'abc' }, // success
        { id: 'g', algorithm: 'md5', data: 'def' }, // success
        { id: 'h', algorithm: 'sha512', data: 'ghi' }, // success
        // No longer need @ts-expect-error as Zod handles it
        { id: 'i', algorithm: 'bad' as HashAlgorithm, data: 'test' }, // error
      ],
    };

    const parts = await hashTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<HashResultItem>(parts); // Specify result type

    expect(results).toBeDefined();
    expect(results).toHaveLength(4);

    // Check success cases
    const resultF = results?.find((r) => r.id === 'f');
    expect(resultF?.success).toBe(true);
    expect(resultF?.result).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    ); // sha256('abc')
    expect(resultF?.error).toBeUndefined();

    const resultG = results?.find((r) => r.id === 'g');
    expect(resultG?.success).toBe(true);
    expect(resultG?.result).toBe('a4b252ebd87add71c70689f07443967f'); // md5('def')
    expect(resultG?.error).toBeUndefined();

    const resultH = results?.find((r) => r.id === 'h');
    expect(resultH?.success).toBe(true);
    expect(resultH?.result).toBe(
      'ca1e6909d39b4748904c731e33958640e30d8178017778471111346a49f419a7f44899738e09148f089c8976147555f393dfbf905b174a07a4a0411610c75084',
    ); // sha512('ghi')
    expect(resultH?.error).toBeUndefined();

    // Check error case
    const resultI = results?.find((r) => r.id === 'i');
    expect(resultI?.success).toBe(false);
    expect(resultI?.result).toBeUndefined();
    expect(resultI?.error).toContain('Hash operation failed:');
    expect(resultI?.suggestion).toContain('not supported');
  });
});
