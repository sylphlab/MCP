import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';
import { createHash, getHashes } from 'crypto';

// --- Zod Schemas ---

// Get available algorithms dynamically for validation
const supportedAlgorithms = getHashes();
// Ensure the array is not empty before creating the enum
const HashAlgorithmEnum = supportedAlgorithms.length > 0
  ? z.enum(supportedAlgorithms as [string, ...string[]])
  : z.string().refine(() => false, { message: "No hash algorithms available on the system" }); // Fallback if no hashes found

// Schema for a single hash request item
const HashInputItemSchema = z.object({
  id: z.string().optional(),
  algorithm: HashAlgorithmEnum,
  data: z.string(), // Assuming string input
});

// Main input schema: an array of hash items
export const HashToolInputSchema = z.object({
  items: z.array(HashInputItemSchema).min(1, 'At least one hash item is required.'),
});

// --- TypeScript Types ---
export type HashAlgorithm = z.infer<typeof HashAlgorithmEnum>;
export type HashInputItem = z.infer<typeof HashInputItemSchema>;
export type HashToolInput = z.infer<typeof HashToolInputSchema>;

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
export const hashTool: McpTool<typeof HashToolInputSchema, HashToolOutput> = {
  name: 'hash',
  description: 'Computes cryptographic hashes for one or more input strings.',
  inputSchema: HashToolInputSchema, // Schema expects { items: [...] }

  async execute(input: HashToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<HashToolOutput> {
    // Input validation happens before execute in the registerTools helper
    const { items } = input;
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