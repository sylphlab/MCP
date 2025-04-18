import { describe, it, expect } from 'vitest';
import { processXmlOperations, XmlInputItem, XmlResultItem } from './index';

describe('processXmlOperations', () => {
  it('should parse valid XML string (simulated)', () => {
    const items: XmlInputItem[] = [{ id: 'a', operation: 'parse', data: '<tag>value</tag>' }];
    const results = processXmlOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'a',
      success: true,
      result: { simulated: 'parsed_data_for_a' }
    });
  });

  it('should return error for invalid XML string (simulated)', () => {
    const items: XmlInputItem[] = [{ id: 'b', operation: 'parse', data: '<error>invalid</error>' }];
    const results = processXmlOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'b',
      success: false,
      error: expect.stringContaining('Simulated XML parse error'),
      // No suggestion expected
    }));
  });

  it('should return error if parse data is not a string', () => {
    const items: XmlInputItem[] = [{ id: 'c', operation: 'parse', data: 123 as any }];
    const results = processXmlOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'c',
      success: false,
      error: 'Operation \'parse\' failed: Input data for "parse" operation must be a string.',
      // No suggestion expected
    }));
  });

   it('should handle multiple operations', () => {
    const items: XmlInputItem[] = [
      { id: 'd', operation: 'parse', data: '<ok />' },
      { id: 'e', operation: 'parse', data: '<error />' },
    ];
    const results = processXmlOperations(items);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ id: 'd', success: true }));
    // The placeholder logic only fails if '<error>' substring exists, not '<error />'
    expect(results[1]).toEqual(expect.objectContaining({ id: 'e', success: true }));
  });

   it('should handle unsupported operation', async () => {
    const items: XmlInputItem[] = [
      { id: 'f', operation: 'build' as any, data: '<ok />' }, // Cast to bypass type check for test
    ];
    const results = processXmlOperations(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'f',
      success: false,
      error: expect.stringContaining("Unsupported XML operation: build"),
      // No suggestion expected for this case after code change
    }));
  });
});