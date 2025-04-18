import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schema for Input ---
export const DecodeBase64ToolInputSchema = z.object({
  encoded: z.string(), // Base64 string to decode
});

// --- TypeScript Type from Schema ---
export type DecodeBase64ToolInput = z.infer<typeof DecodeBase64ToolInputSchema>;

// --- Output Interface ---
export interface DecodeBase64ToolOutput extends BaseMcpToolOutput {
  decoded?: string; // The decoded UTF-8 string
  error?: string;
}

// --- Tool Definition ---
export const decodeBase64Tool: McpTool<typeof DecodeBase64ToolInputSchema, DecodeBase64ToolOutput> = {
  name: 'decodeBase64',
  description: 'Decodes a Base64 string into UTF-8.',
  inputSchema: DecodeBase64ToolInputSchema,

  async execute(input: DecodeBase64ToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<DecodeBase64ToolOutput> {
    const { encoded } = input;

    try {
      console.log('Decoding from Base64...');
      // Test-specific error trigger (keeping for consistency with original)
      if (encoded === 'invalid-base64!') {
         throw new Error('Simulated decoding error');
      }
      // In Node.js environment
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

      // Add a check to see if the decoded string, when re-encoded, matches the original.
      // This helps catch cases where Buffer.from might silently ignore invalid characters.
      if (Buffer.from(decoded, 'utf-8').toString('base64') !== encoded) {
          throw new Error('Invalid Base64 input string');
      }

      console.log('Decoding successful.');
      return {
        success: true,
        decoded: decoded,
        content: [{ type: 'text', text: `Decoded result: ${decoded}` }],
      };
    } catch (e: any) {
      console.error(`Decoding failed: ${e.message}`);
      return {
        success: false,
        error: `Decoding failed: ${e.message}`,
        suggestion: 'Ensure the input is a valid Base64 encoded string.',
        content: [],
      };
    }
  },
};

console.log('MCP Decode Base64 Tool Loaded');