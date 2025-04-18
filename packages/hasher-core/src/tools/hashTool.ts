import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';
import { createHash, getHashes } from 'crypto';

// --- Zod Schemas ---

// Get available algorithms dynamically for validation
const supportedAlgorithms = getHashes();
const HashAlgorithmEnum = z.enum(supportedAlgorithms as [string, ...string[]]); // Cast needed for non-empty array

// Schema for a single hash operation item
const HasherInputItemSchema = z.object({
  id: z.string().optional(),
  algorithm: HashAlgorithmEnum,
  data: z.string(), // Assuming string input
});

// Main input schema: an array of hash items
export const HashToolInputSchema = z.object({
  items: z.array(HasherInputItemSchema).min(1, 'At least one hash item is required.'),
});

// --- TypeScript Types ---
export type HashAlgorithm = z.infer<typeof HashAlgorithmEnum>;
export type HasherInputItem = z.infer<typeof HasherInputItemSchema>;
export type HashToolInput = z.infer<typeof HashToolInputSchema>;

// Interface for a single hash result item
export interface HasherResultItem {
  id?: string;
  success: boolean;
  result?: string; // The computed hash
  error?: string;
  suggestion?: string;
}

// Output interface for the tool
export interface HashToolOutput extends BaseMcpToolOutput {
  results: HasherResultItem[];
  error?: string; // Optional overall error
}

// --- Tool Definition ---

// Re-implement the core logic within the execute method
async function processSingleHash(item: HasherInputItem): Promise<HasherResultItem> {
  const { id, algorithm, data } = item;
  const resultItem: HasherResultItem = { id, success: false };

  try {
    // Validation is now primarily handled by Zod schema, but keep runtime checks if necessary
    // (Zod handles algorithm check against the dynamic enum)
    if (typeof data !== 'string') {
       throw new Error('Input data must be a string.');
    }

    console.log(`Computing ${algorithm} hash... (ID: ${id ?? 'N/A'})`);
    resultItem.result = createHash(algorithm).update(data).digest('hex');
    resultItem.success = true;
    console.log(`Hash computed successfully. (ID: ${id ?? 'N/A'})`);

  } catch (e: any) {
    resultItem.error = `Operation failed: ${e.message}`;
    resultItem.suggestion = 'Check algorithm name and input data type.';
    console.error(resultItem.error);
  }
  return resultItem;
}

export const hashTool: McpTool<typeof HashToolInputSchema, HashToolOutput> = {
  name: 'hash',
  description: 'Computes cryptographic hashes (e.g., sha256, md5) for one or more input strings.',
  inputSchema: HashToolInputSchema,

  async execute(input: HashToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<HashToolOutput> {
    const { items } = input; // Input is validated by the server
    const results: HasherResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process sequentially
      for (const item of items) {
        // Use Promise.resolve to ensure it's awaitable, though processSingleHash is already async
        const result = await Promise.resolve(processSingleHash(item));
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
        }
      }

      return {
        success: overallSuccess,
        results: results,
        content: [{ type: 'text', text: `Processed ${items.length} hash operations. Overall success: ${overallSuccess}` }],
      };
    } catch (e: any) {
      console.error(`Unexpected error during hash tool execution: ${e.message}`);
      return {
        success: false,
        results: results,
        error: `Unexpected tool error: ${e.message}`,
        content: [],
      };
    }
  },
};

console.log('MCP Hash Tool Loaded');