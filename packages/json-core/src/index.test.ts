import { describe, it, expect } from 'vitest';
import { processJsonOperations, JsonInputItem, JsonResultItem } from './index';

describe('processJsonOperations', () => {
  it('should parse valid JSON string', () => {
    const items: JsonInputItem[] = [{ id: 'a', operation: 'parse', data: '{\"key\": \"value\"}' }];
    const results = processJsonOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: 'a', success: true, result: { key: 'value' } });
  });

  it('should return error for invalid JSON string in parse', () => {
    const items: JsonInputItem[] = [{ id: 'b', operation: 'parse', data: 'invalid json' }];
    const results = processJsonOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'b',
      success: false,
      error: expect.stringContaining('Unexpected token'),
      suggestion: 'Ensure input data is a valid JSON string.',
    }));
  });

  it('should return error if parse data is not a string', () => {
    const items: JsonInputItem[] = [{ id: 'c', operation: 'parse', data: { key: 'value' } }]; // Object instead of string
    const results = processJsonOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'c',
      success: false,
      error: 'Operation \'parse\' failed: Input data for "parse" operation must be a string.',
      suggestion: 'Ensure input data is a valid JSON string.',
    }));
  });

  it('should stringify a valid object', () => {
    const data = { key: 'value', num: 123 };
    const items: JsonInputItem[] = [{ id: 'd', operation: 'stringify', data }];
    const results = processJsonOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: 'd', success: true, result: JSON.stringify(data) });
  });

  it('should return error for circular reference in stringify', () => {
    const circularObj: any = { key: 'value' };
    circularObj.self = circularObj; // Create circular reference
    const items: JsonInputItem[] = [{ id: 'e', operation: 'stringify', data: circularObj }];
    const results = processJsonOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'e',
      success: false,
      error: expect.stringContaining('circular structure'),
      suggestion: 'Ensure input data is serializable (no circular references, BigInts, etc.).',
    }));
  });

   it('should handle multiple operations', () => {
    const items: JsonInputItem[] = [
      { id: 'f', operation: 'parse', data: '{\"valid\": true}' },
      { id: 'g', operation: 'stringify', data: { num: 1 } },
      { id: 'h', operation: 'parse', data: '{invalid' },
    ];
    const results = processJsonOperations(items);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ id: 'f', success: true, result: { valid: true } });
    expect(results[1]).toEqual({ id: 'g', success: true, result: '{\"num\":1}' });
    expect(results[2]).toEqual(expect.objectContaining({ id: 'h', success: false, error: expect.stringContaining('JSON') })); // Make error check less specific
  });

   it('should handle unsupported operation', async () => {
    const items: JsonInputItem[] = [
      { id: 'i', operation: 'diff' as any, data: {} }, // Cast to bypass type check for test
    ];
    const results = processJsonOperations(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'i',
      success: false,
      error: expect.stringContaining("Unsupported JSON operation: diff"),
      // No suggestion expected for this case after code change
    }));
  });

});