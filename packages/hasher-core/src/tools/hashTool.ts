import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';
import { createHash } from 'crypto';
import { hashToolInputSchema, HashItemSchema, HashAlgorithmEnum } from './hashTool.schema.js'; // Import schema (added .js)

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
    console.log(`Computing ${algorithm} hash... (ID: ${id ?? 'N/A'})`);
    const hashResult = createHash(algorithm).update(data).digest('hex');
    console.log(`Hash computed successfully. (ID: ${id ?? 'N/A'})`);

    resultItem.success = true;
    resultItem.result = hashResult;

  } catch (e: any) {
    // Catch errors during the actual hash operation
    resultItem.error = `Hash operation failed: ${e.message}`;
    resultItem.suggestion = 'Check algorithm name and input data type.';
    console.error(`${resultItem.error} (ID: ${id ?? 'N/A'})`);
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

  async execute(input: HashToolInput, options: McpToolExecuteOptions): Promise<HashToolOutput> { // Remove workspaceRoot, require options
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
      const contentText = JSON.stringify({
          summary: `Processed ${items.length} hash requests. Overall success: ${overallSuccess}`,
          results: results
      }, null, 2); // Pretty-print JSON

      return {
        success: overallSuccess,
        results: results, // Keep original results field too
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (e: any) {
      // Catch unexpected errors during the loop itself (should be rare)
      const errorMsg = `Unexpected error during hash tool execution: ${e.message}`;
      console.error(errorMsg);
      const errorContentText = JSON.stringify({
          error: errorMsg,
          results: results // Include partial results in error content too
      }, null, 2);
      return {
        success: false,
        results: results, // Keep partial results here too
        error: errorMsg, // Keep top-level error
        content: [{ type: 'text', text: errorContentText }], // Put error JSON in content
      };
    }
  },
};

console.log('MCP Hash Core Tool (Batch Operation) Loaded');