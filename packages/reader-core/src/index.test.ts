import { describe, it, expect } from 'vitest';
import { processReadOperations, ReaderInputItem, ReaderResultItem } from './index';

describe('processReadOperations', () => {
  it('should read PDF text (simulated)', async () => {
    const items: ReaderInputItem[] = [{ id: 'a', operation: 'readPdfText', filePath: 'test.pdf' }];
    const results = await processReadOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'a',
      success: true,
      result: 'Simulated text from test.pdf'
    });
  });

  it('should return error for invalid filePath', async () => {
    const items: ReaderInputItem[] = [{ id: 'b', operation: 'readPdfText', filePath: '' }]; // Empty path
    const results = await processReadOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'b',
      success: false,
      error: expect.stringContaining('Missing or invalid filePath'),
      suggestion: expect.any(String),
    }));
  });

  it('should return error for simulated PDF error', async () => {
    const items: ReaderInputItem[] = [{ id: 'c', operation: 'readPdfText', filePath: 'error.pdf' }];
    const results = await processReadOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'c',
      success: false,
      error: expect.stringContaining('Simulated PDF read error'),
      suggestion: expect.any(String),
    }));
  });

   it('should handle multiple operations', async () => {
    const items: ReaderInputItem[] = [
      { id: 'd', operation: 'readPdfText', filePath: 'file1.pdf' },
      { id: 'e', operation: 'readPdfText', filePath: 'error.pdf' }, // Error case
      { id: 'f', operation: 'readPdfText', filePath: 'file2.pdf' },
    ];
    const results = await processReadOperations(items);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(expect.objectContaining({ id: 'd', success: true }));
    expect(results[1]).toEqual(expect.objectContaining({ id: 'e', success: false }));
    expect(results[2]).toEqual(expect.objectContaining({ id: 'f', success: true }));
  });

   it('should handle unsupported operation', async () => {
    const items: ReaderInputItem[] = [
      { id: 'g', operation: 'readPdfMarkdown' as any, filePath: 'test.pdf' },
    ];
    const results = await processReadOperations(items);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'g',
      success: false,
      error: expect.stringContaining("Unsupported reader operation: readPdfMarkdown"),
      suggestion: expect.any(String),
    }));
  });
});