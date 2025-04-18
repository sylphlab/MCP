import { describe, it, expect } from 'vitest';
import { readPdfText } from './index';

describe('readPdfText', () => {
  it('should return simulated text for a dummy path', async () => {
    const filePath = 'dummy.pdf';
    const result = await readPdfText(filePath);
    expect(result).toBe(`Simulated text from ${filePath}`);
  });
});