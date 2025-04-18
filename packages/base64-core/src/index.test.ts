import { Buffer } from 'buffer'; // Import Buffer for mocking

import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { encodeBase64 } from './index';

describe('encodeBase64', () => {
  it('should encode string to Base64', () => {
    const result = encodeBase64('hello world');
    // Correct base64 for 'hello world'
    expect(result).toBe('aGVsbG8gd29ybGQ=');
  });
  // Add test for empty string if desired
  it('should handle empty string', () => {
    const result = encodeBase64('');
    expect(result).toBe('');
  });
});

  it('should handle encoding errors', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    const bufferFromSpy = vi.spyOn(Buffer, 'from').mockImplementation(() => {
      throw new Error('Mock encoding error');
    });

    const result = encodeBase64('trigger error');

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('Encoding failed');

    // Restore mocks
    bufferFromSpy.mockRestore();
    consoleSpy.mockRestore();
  });