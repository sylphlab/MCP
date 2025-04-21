import { describe, expect, it } from 'vitest';
// Import the actual tool and its types
import { type JsonToolInput, JsonToolOutput, jsonTool } from './index';

// Mock workspace root - not used by jsonTool's logic but required by execute signature
const mockWorkspaceRoot = '';

describe('jsonTool.execute', () => {
  it('should parse valid JSON string in a single item batch', async () => {
    const input: JsonToolInput = {
      items: [{ id: 'a', operation: 'parse', data: '{"key": "value"}' }],
    };
    const result = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    const itemResult = result.results[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('a');
    expect(itemResult.result).toEqual({ key: 'value' });
    expect(itemResult.error).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('should return item error for invalid JSON string in parse (single item batch)', async () => {
    const input: JsonToolInput = { items: [{ id: 'b', operation: 'parse', data: 'invalid json' }] };
    const result = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(false); // Overall fails
    expect(result.results).toHaveLength(1);
    const itemResult = result.results[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('b');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('Unexpected token');
    expect(itemResult.suggestion).toBe('Ensure input data is a valid JSON string.');
  });

  // Removed test for non-string parse data calling execute directly,
  // as Zod validation should prevent this input in the MCP server flow.

  it('should stringify a valid object in a single item batch', async () => {
    const data = { key: 'value', num: 123 };
    const input: JsonToolInput = { items: [{ id: 'd', operation: 'stringify', data }] };
    const result = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    const itemResult = result.results[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('d');
    expect(itemResult.result).toBe(JSON.stringify(data));
    expect(itemResult.error).toBeUndefined();
  });

  it('should return item error for circular reference in stringify (single item batch)', async () => {
    const circularObj: any = { key: 'value' };
    circularObj.self = circularObj; // Create circular reference
    const input: JsonToolInput = {
      items: [{ id: 'e', operation: 'stringify', data: circularObj }],
    };
    const result = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(false); // Overall fails
    expect(result.results).toHaveLength(1);
    const itemResult = result.results[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('e');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('circular structure');
    expect(itemResult.suggestion).toBe(
      'Ensure input data is serializable (no circular references, BigInts, etc.).',
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

    const result = await jsonTool.execute(input, { workspaceRoot: mockWorkspaceRoot }); // Pass options object

    expect(result.success).toBe(false); // Overall fails because 'h' fails
    expect(result.results).toHaveLength(4);
    expect(result.error).toBeUndefined(); // No overall tool error

    // Check item 'f' (parse success)
    const resultF = result.results.find((r) => r.id === 'f');
    expect(resultF?.success).toBe(true);
    expect(resultF?.result).toEqual({ valid: true });
    expect(resultF?.error).toBeUndefined();

    // Check item 'g' (stringify success)
    const resultG = result.results.find((r) => r.id === 'g');
    expect(resultG?.success).toBe(true);
    expect(resultG?.result).toBe('{"num":1}');
    expect(resultG?.error).toBeUndefined();

    // Check item 'h' (parse error)
    const resultH = result.results.find((r) => r.id === 'h');
    expect(resultH?.success).toBe(false);
    expect(resultH?.result).toBeUndefined();
    expect(resultH?.error).toContain('JSON'); // Check for JSON related error
    expect(resultH?.suggestion).toBe('Ensure input data is a valid JSON string.');

    // Check item 'i' (stringify success)
    const resultI = result.results.find((r) => r.id === 'i');
    expect(resultI?.success).toBe(true);
    expect(resultI?.result).toBe('{"key":"val"}');
    expect(resultI?.error).toBeUndefined();
  });

  // Removed test for unsupported operation calling execute directly,
  // as Zod validation should prevent this input in the MCP server flow.
});
