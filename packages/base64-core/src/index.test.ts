import { describe, it, expect, vi } from 'vitest';
import { encodeBase64, decodeBase64 } from './index';
// No longer need Buffer or vi.mock related imports here

describe('encodeBase64', () => {
  it('should encode string to Base64', () => {
    const result = encodeBase64('hello world');
    expect(result).toBe('aGVsbG8gd29ybGQ=');
  });

  it('should handle empty string', () => {
    const result = encodeBase64('');
    expect(result).toBe('');
  });

  it('should handle encoding errors', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    // Call function that should trigger internal throw and catch
    const result = encodeBase64('trigger error');

    expect(result).toBe(''); // Expect empty string from catch block
    expect(consoleSpy).toHaveBeenCalledWith('Encoding failed');

    // Restore console spy
    consoleSpy.mockRestore();
  });
}); // End describe encodeBase64

describe('decodeBase64', () => {
  it('should decode Base64 string correctly', () => {
    const result = decodeBase64('aGVsbG8gd29ybGQ=');
    expect(result).toBe('hello world');
  });

  it('should handle empty string', () => {
    const result = decodeBase64('');
    expect(result).toBe('');
  });

  it('should handle decoding errors (invalid base64)', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    // Call function that should trigger internal throw and catch
    const result = decodeBase64('invalid-base64!');
    expect(result).toBe(''); // Expect empty string from catch block
    expect(consoleSpy).toHaveBeenCalledWith('Decoding failed (invalid base64 string?)');

    // Restore console spy
    consoleSpy.mockRestore();
  });
}); // End describe decodeBase64