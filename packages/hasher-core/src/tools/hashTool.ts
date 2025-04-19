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

// Input schema for a SINGLE hash operation
export const HashToolInputSchema = z.object({
  // id is usually for correlating batch results, less relevant for single op, but keep for potential direct use
  id: z.string().optional(),
  algorithm: HashAlgorithmEnum,
  data: z.string(), // Assuming string input
});

// --- TypeScript Types ---
export type HashAlgorithm = z.infer<typeof HashAlgorithmEnum>;
export type HashToolInput = z.infer<typeof HashToolInputSchema>;

// Output interface for a SINGLE hash result
export interface HashToolOutput extends BaseMcpToolOutput {
  // BaseMcpToolOutput provides 'success' and 'content'
  id?: string; // Keep id for correlation if used in batch by server
  result?: string; // The computed hash
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---
export const hashTool: McpTool<typeof HashToolInputSchema, HashToolOutput> = {
  name: 'hash', // Tool name can represent the single operation capability
  description: 'Computes a cryptographic hash for a single input string.',
  inputSchema: HashToolInputSchema, // Schema for single item

  async execute(input: HashToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<HashToolOutput> {
    // Logic now directly processes the single 'input' object.
    const { id, algorithm, data } = input;

    try {
      // Input type validation is handled by Zod before execute is called

      console.log(`Computing ${algorithm} hash... (ID: ${id ?? 'N/A'})`);
      const hashResult = createHash(algorithm).update(data).digest('hex');
      console.log(`Hash computed successfully. (ID: ${id ?? 'N/A'})`);

      return {
        success: true,
        id: id, // Include id in the single result
        result: hashResult,
        content: [{ type: 'text', text: `Computed ${algorithm} hash: ${hashResult}` }],
      };
    } catch (e: any) {
      // Catch errors during the actual hash operation
      const errorMsg = `Hash operation failed: ${e.message}`;
      console.error(errorMsg);
      return {
        success: false,
        id: id, // Include id in the error result
        error: errorMsg,
        suggestion: 'Check algorithm name and input data type.',
        content: [],
      };
    }
  },
};

console.log('MCP Hash Tool (Single Operation) Loaded');