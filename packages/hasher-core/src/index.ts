import { createHash, getHashes } from 'crypto';

// Define Input and Output structures for batch processing
// Use crypto.getHashes() for dynamic algorithm support if needed, or define explicitly
// const supportedAlgorithms = getHashes(); // Example
type HashAlgorithm = 'sha256' | 'sha512' | 'md5'; // Explicit list for now

interface HasherInputItem {
  id?: string;
  algorithm: HashAlgorithm;
  data: string; // Assuming string input for hashing
}

interface HasherResultItem {
  id?: string;
  success: boolean;
  result?: string; // The computed hash
  error?: string;
  suggestion?: string;
}

/**
 * Processes multiple hashing operations.
 * @param items An array of HasherInputItem objects.
 * @returns An array of HasherResultItem objects.
 */
export function processHashOperations(items: HasherInputItem[]): HasherResultItem[] {
  const results: HasherResultItem[] = [];
  const supportedAlgorithms = getHashes(); // Get available hashes on the system

  for (const item of items) {
    const { id, algorithm, data } = item;
    const resultItem: HasherResultItem = { id, success: false };

    try {
      if (!algorithm || typeof algorithm !== 'string') {
        throw new Error('Missing or invalid algorithm specified.');
      }
      if (!supportedAlgorithms.includes(algorithm)) {
         throw new Error(`Unsupported hash algorithm: ${algorithm}. Supported: ${supportedAlgorithms.join(', ')}`);
      }
      if (typeof data !== 'string') {
         // Or handle Buffer input if needed
         throw new Error('Input data must be a string.');
      }

      console.log(`Computing ${algorithm} hash... (ID: ${id ?? 'N/A'})`);
      resultItem.result = createHash(algorithm).update(data).digest('hex');
      resultItem.success = true;
      console.log(`Hash computed successfully. (ID: ${id ?? 'N/A'})`);

    } catch (e: any) {
      resultItem.error = `Operation failed: ${e.message}`;
      resultItem.suggestion = 'Check algorithm name and input data type.';
    }
    results.push(resultItem);
  }

  return results;
}


console.log('MCP Hasher Core Package Loaded');

export type { HasherInputItem, HasherResultItem, HashAlgorithm };
