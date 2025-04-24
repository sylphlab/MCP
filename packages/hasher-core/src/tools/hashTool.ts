import { createHash } from 'node:crypto';
import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart } from '@sylphlab/mcp-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import {
  type HashAlgorithmEnum,
  type HashItemSchema,
  hashToolInputSchema,
} from './hashTool.schema.js';

// --- TypeScript Types ---
export type HashAlgorithm = z.infer<typeof HashAlgorithmEnum>;
export type HashInputItem = z.infer<typeof HashItemSchema>;
export type HashToolInput = z.infer<typeof hashToolInputSchema>;

// --- Output Types ---
// Interface for a single hash result item
export interface HashResultItem {
  /** Optional ID from the input item. */
  id?: string;
  /** Whether the hash operation for this item was successful. */
  success: boolean;
  /** The computed hash string (hex encoded), if successful. */
  result?: string;
  /** Error message, if hashing failed for this item. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const HashResultItemSchema = z.object({
  id: z.string().optional(),
  success: z.boolean(),
  result: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const HashToolOutputSchema = z.array(HashResultItemSchema);

// --- Helper Function ---

// Helper function to process a single hash item
async function processSingleHash(item: HashInputItem): Promise<HashResultItem> {
  const { id, algorithm, data } = item;
  const resultItem: HashResultItem = { id, success: false };

  try {
    const hashResult = createHash(algorithm).update(data).digest('hex');
    resultItem.success = true;
    resultItem.result = hashResult;
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown hashing error';
    resultItem.error = `Hash operation failed: ${errorMsg}`;
    // Check if the error is likely due to an invalid algorithm
    if (
      errorMsg.includes('Digest method not supported') ||
      errorMsg.includes('Unknown algorithm')
    ) {
      resultItem.suggestion = `The algorithm '${algorithm}' is not supported by the underlying crypto library. Check available algorithms.`;
    } else {
      resultItem.suggestion = 'Check algorithm name and input data type.';
    }
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const hashTool = defineTool({
  name: 'hash',
  description: 'Computes cryptographic hashes for one or more input strings.',
  inputSchema: hashToolInputSchema,
  // Use the array schema

  execute: async (input: HashToolInput, _options: ToolExecuteOptions): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = hashToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items } = parsed.data;

    const results: HashResultItem[] = [];

    // Process requests sequentially (or could be parallelized with Promise.all)
    for (const item of items) {
      const result = await processSingleHash(item);
      results.push(result);
      // No need to track overallSuccess, the structure implies partial success is ok
    }

    // Return the results wrapped in jsonPart
    return [jsonPart(results, HashToolOutputSchema)];
  },
});
