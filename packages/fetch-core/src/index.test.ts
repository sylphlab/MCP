import { describe, it, expect } from 'vitest';
import { fetchData } from './index';

describe('fetchData', () => {
  it('should return placeholder data', async () => {
    const url = 'test.com';
    const result = await fetchData(url);
    expect(result).toBe(`Data from ${url}`);
  });
});