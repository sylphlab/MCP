import { describe, it, expect } from 'vitest';
import { parseXml } from './index';

describe('parseXml', () => {
  it('should return placeholder object for valid XML (simulated)', () => {
    const result = parseXml('<tag>data</tag>');
    expect(result).toEqual({ simulated: 'data' });
  });

  it('should return null for error XML (simulated)', () => {
    const result = parseXml('<error>fail</error>');
    expect(result).toBeNull();
  });

  it('should handle empty string', () => {
    // Assuming empty string is invalid for the placeholder
    const result = parseXml('');
    expect(result).toEqual({ simulated: 'data' }); // Or null depending on desired placeholder behavior
  });
});