import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeHash } from './index';
import * as crypto from 'crypto'; // Import namespace for mocking type safety

// Store the actual crypto implementation before mocking
const actualCrypto = await vi.importActual<typeof crypto>('crypto');

// Mock the crypto module
vi.mock('crypto');

describe('computeHash', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();

    // Default mock implementation for successful hashing
    vi.mocked(crypto.createHash).mockImplementation((algorithm: string) => {
      // Use the actual implementation for the default mock
      const hash = actualCrypto.createHash(algorithm);
      return {
        update: vi.fn((data) => hash.update(data)),
        digest: vi.fn((encoding) => hash.digest(encoding)),
      } as unknown as crypto.Hash; // Cast needed as mock methods differ slightly
    });
  });

  it('should compute SHA256 hash correctly', () => {
    const input = 'hello world';
    const expectedHash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
    const result = computeHash(input);
    expect(result).toBe(expectedHash);
  });

  it('should handle empty string', () => {
    const input = '';
    // SHA256 hash of an empty string
    const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const result = computeHash(input);
    expect(result).toBe(expectedHash);
  });

  it('should handle hashing errors', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    // Mock createHash specifically for this test to throw an error
    // Override mock specifically for this test to throw an error
    vi.mocked(crypto.createHash).mockImplementation(() => {
      throw new Error('Mock hashing error');
    });

    const result = computeHash('trigger error');

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('Hashing failed');

    // Restore console spy
    consoleSpy.mockRestore();
  });
});