import { createHash } from 'node:crypto';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import {
  type HashAlgorithmEnum,
  type HashItemSchema,
  hashToolInputSchema,
} from './hashTool.schema.js'; // Import schema (added .js)

// --- TypeScript Types ---
export type HashAlgorithm = z.infer<typeof HashAlgorithmEnum>;
export type HashInputItem = z.infer<typeof HashItemSchema>; // Fixed schema name
export type HashToolInput = z.infer<typeof hashToolInputSchema>;

// Interface for a single hash result item
export interface HashResultItem {
  id?: string;
  success: boolean;
  result?: string; // The computed hash
  error?: string;
  suggestion?: string;
}

// Output interface for the tool (includes multiple results)
export interface HashToolOutput extends BaseMcpToolOutput {
  results: HashResultItem[];
  error?: string; // Optional overall error if the tool itself fails unexpectedly
}

// --- Helper Function ---

// Helper function to process a single hash item
async function processSingleHash(item: HashInputItem): Promise<HashResultItem> {
  const { id, algorithm, data } = item;
  const resultItem: HashResultItem = { id, success: false }; // Initialize success to false

  try {
    const hashResult = createHash(algorithm).update(data).digest('hex');

    resultItem.success = true;
    resultItem.result = hashResult;
  } catch (e: unknown) {
    // Catch errors during the actual hash operation
    const errorMsg = e instanceof Error ? e.message : 'Unknown hashing error';
    resultItem.error = `Hash operation failed: ${errorMsg}`;
    resultItem.suggestion = 'Check algorithm name and input data type.';
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const hashTool = defineTool({
  name: 'hash',
  description: 'Computes cryptographic hashes for one or more input strings.',
  inputSchema: hashToolInputSchema, // Schema expects { items: [...] }

  execute: async ( // Core logic passed to defineTool
    input: HashToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<HashToolOutput> => { // Still returns the specific output type

    // Input validation is handled by registerTools/SDK before execute is called
    const { items } = input;

    const results: HashResultItem[] = [];
    let overallSuccess = true;

    // Removed the outermost try/catch block; defineTool handles unexpected errors

    // Process requests sequentially
    for (const item of items) {
      // processSingleHash already includes its own try/catch for hashing errors
      const result = await processSingleHash(item);
      results.push(result);
      if (!result.success) {
        overallSuccess = false; // Mark overall as failed if any item fails
      }
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Processed ${items.length} hash requests. Overall success: ${overallSuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess,
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { HashToolInput, HashToolOutput, HashResultItem, HashInputItem, HashAlgorithm }; // Removed duplicate export
