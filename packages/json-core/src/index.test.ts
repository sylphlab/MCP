import { describe, it, expect } from 'vitest';
import { parseJson } from './index';

describe('parseJson', () => {
  it('should parse valid JSON', () => {
    const result = parseJson('{\"key\": \"value\"}');
    expect(result).toEqual({ key: 'value' });
  });
  it('should return null for invalid JSON', () => {
    const result = parseJson('invalid json');
    expect(result).toBeNull();
  });
});