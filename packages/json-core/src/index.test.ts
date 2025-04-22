import type { Part } from '@sylphlab/mcp-core'; // Import Part type
import { describe, expect, it } from 'vitest';
// Import the actual tool and its types
import { type JsonToolInput, jsonTool } from './index.js'; // Removed JsonToolOutput import
import type { JsonResultItem } from './tools/jsonTool.js';

// Mock workspace root - not used by jsonTool's logic but required by execute signature
const mockWorkspaceRoot = '';

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

describe('jsonTool.execute', () => {
  it('should parse valid JSON string in a single item batch', async () => {
    const input: JsonToolInput = {
      items: [{ id: 'a', operation: 'parse', data: '{"key": "value"}' }],
    };
    const parts = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('a');
    expect(itemResult.result).toEqual({ key: 'value' });
    expect(itemResult.error).toBeUndefined();
  });

  it('should return item error for invalid JSON string in parse (single item batch)', async () => {
    const input: JsonToolInput = { items: [{ id: 'b', operation: 'parse', data: 'invalid json' }] };
    const parts = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('b');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('JSON'); // More specific check might depend on JSON.parse error message
    expect(itemResult.suggestion).toBe(
      'Ensure input data is a valid JSON string. Check for syntax errors like missing quotes or commas.',
    );
  });

  it('should stringify a valid object in a single item batch', async () => {
    const data = { key: 'value', num: 123 };
    const input: JsonToolInput = { items: [{ id: 'd', operation: 'stringify', data }] };
    const parts = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('d');
    expect(itemResult.result).toBe(JSON.stringify(data));
    expect(itemResult.error).toBeUndefined();
  });

  it('should return item error for circular reference in stringify (single item batch)', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Intentional any for testing
    const circularObj: any = { key: 'value' };
    circularObj.self = circularObj;
    const input: JsonToolInput = {
      items: [{ id: 'e', operation: 'stringify', data: circularObj }],
    };
    const parts = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('e');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('circular structure');
    expect(itemResult.suggestion).toBe(
      'Ensure input data is serializable (no circular references, BigInts, etc.). Check the structure of the object.',
    );
  });

  it('should process a batch of multiple JSON operations', async () => {
    const input: JsonToolInput = {
      items: [
        { id: 'f', operation: 'parse', data: '{"valid": true}' }, // success
        { id: 'g', operation: 'stringify', data: { num: 1 } }, // success
        { id: 'h', operation: 'parse', data: '{invalid' }, // error
        { id: 'i', operation: 'stringify', data: { key: 'val' } }, // success
      ],
    };

    const parts = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(4);

    // Check item 'f' (parse success)
    const resultF = results?.find((r) => r.id === 'f');
    expect(resultF?.success).toBe(true);
    expect(resultF?.result).toEqual({ valid: true });
    expect(resultF?.error).toBeUndefined();

    // Check item 'g' (stringify success)
    const resultG = results?.find((r) => r.id === 'g');
    expect(resultG?.success).toBe(true);
    expect(resultG?.result).toBe('{"num":1}');
    expect(resultG?.error).toBeUndefined();

    // Check item 'h' (parse error)
    const resultH = results?.find((r) => r.id === 'h');
    expect(resultH?.success).toBe(false);
    expect(resultH?.result).toBeUndefined();
    expect(resultH?.error).toContain('JSON');
    expect(resultH?.suggestion).toBe(
      'Ensure input data is a valid JSON string. Check for syntax errors like missing quotes or commas.',
    );

    // Check item 'i' (stringify success)
    const resultI = results?.find((r) => r.id === 'i');
    expect(resultI?.success).toBe(true);
    expect(resultI?.result).toBe('{"key":"val"}');
    expect(resultI?.error).toBeUndefined();
  });
});
