import { describe, it, expect } from 'vitest';
import { processHashOperations, HasherInputItem, HasherResultItem } from './index';

describe('processHashOperations', () => {
  it('should compute sha256 hash correctly', () => {
    const items: HasherInputItem[] = [{ id: 'a', algorithm: 'sha256', data: 'hello world' }];
    const results = processHashOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'a',
      success: true,
      result: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    });
  });

  it('should compute md5 hash correctly', () => {
    const items: HasherInputItem[] = [{ id: 'b', algorithm: 'md5', data: 'hello world' }];
    const results = processHashOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'b',
      success: true,
      result: '5eb63bbbe01eeed093cb22bb8f5acdc3', // md5 hash of 'hello world'
    });
  });

  it('should handle empty string', () => {
    const items: HasherInputItem[] = [{ id: 'c', algorithm: 'sha256', data: '' }];
    const results = processHashOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'c',
      success: true,
      result: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
  });

  it('should return error for unsupported algorithm', () => {
    const items: HasherInputItem[] = [{ id: 'd', algorithm: 'invalidAlgo' as any, data: 'test' }];
    const results = processHashOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'd',
      success: false,
      error: expect.stringContaining('Unsupported hash algorithm: invalidAlgo'),
      suggestion: 'Check algorithm name and input data type.',
    }));
  });

  it('should return error for non-string data', () => {
    const items: HasherInputItem[] = [{ id: 'e', algorithm: 'sha256', data: 123 as any }];
    const results = processHashOperations(items);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'e',
      success: false,
      error: 'Operation failed: Input data must be a string.',
      suggestion: 'Check algorithm name and input data type.',
    }));
  });

  it('should process multiple items', () => {
    const items: HasherInputItem[] = [
      { id: 'f', algorithm: 'sha256', data: 'abc' },
      { id: 'g', algorithm: 'md5', data: 'def' },
      { id: 'h', algorithm: 'sha512', data: 'ghi' },
      { id: 'i', algorithm: 'bad' as any, data: 'test' }, // Error case (cast to any)
    ];
    const results = processHashOperations(items);
    expect(results).toHaveLength(4);
    expect(results[0]).toEqual(expect.objectContaining({ id: 'f', success: true, result: expect.any(String) }));
    expect(results[1]).toEqual(expect.objectContaining({ id: 'g', success: true, result: expect.any(String) }));
    expect(results[2]).toEqual(expect.objectContaining({ id: 'h', success: true, result: expect.any(String) }));
    expect(results[3]).toEqual(expect.objectContaining({ id: 'i', success: false, error: expect.stringContaining('Unsupported hash algorithm') }));
  });
});