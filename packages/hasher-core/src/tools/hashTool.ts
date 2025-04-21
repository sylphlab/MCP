import { createHash } from 'node:crypto';
import {
  type BaseMcpToolOutput,
  type McpTool,
  type McpToolExecuteOptions,
  McpToolInput,
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

// --- Tool Definition ---
export const hashTool: McpTool<typeof hashToolInputSchema, HashToolOutput> = {
  name: 'hash',
  description: 'Computes cryptographic hashes for one or more input strings.',
  inputSchema: hashToolInputSchema, // Schema expects { items: [...] }

  async execute(input: HashToolInput, _options: McpToolExecuteOptions): Promise<HashToolOutput> {
    // Remove workspaceRoot, require options
    // Input validation happens before execute in the registerTools helper
    const { items } = input;
    // workspaceRoot is now in options.workspaceRoot if needed
    const results: HashResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process requests sequentially (hashing is usually fast, parallel might not be worth complexity)
      for (const item of items) {
        const result = await processSingleHash(item); // Process each item
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
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
      ); // Pretty-print JSON

      return {
        success: overallSuccess,
        results: results, // Keep original results field too
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (e: unknown) {
      // Catch unexpected errors during the loop itself (should be rare)
      const errorMsg =
        e instanceof Error
          ? `Unexpected error during hash tool execution: ${e.message}`
          : 'Unexpected error during hash tool execution: Unknown error';
      const errorContentText = JSON.stringify(
        {
          error: errorMsg,
          results: results, // Include partial results in error content too
        },
        null,
        2,
      );
      return {
        success: false,
        results: results, // Keep partial results here too
        error: errorMsg, // Keep top-level error
        content: [{ type: 'text', text: errorContentText }], // Put error JSON in content
      };
    }
  },
};
