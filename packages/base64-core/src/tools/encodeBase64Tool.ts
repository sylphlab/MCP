import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schema for Input ---
export const EncodeBase64ToolInputSchema = z.object({
  input: z.string(), // Input string to encode
});

// --- TypeScript Type from Schema ---
export type EncodeBase64ToolInput = z.infer<typeof EncodeBase64ToolInputSchema>;

// --- Output Interface ---
export interface EncodeBase64ToolOutput extends BaseMcpToolOutput {
  encoded?: string; // The Base64 encoded string
  error?: string;
}

// --- Tool Definition ---
export const encodeBase64Tool: McpTool<typeof EncodeBase64ToolInputSchema, EncodeBase64ToolOutput> = {
  name: 'encodeBase64',
  description: 'Encodes a UTF-8 string into Base64.',
  inputSchema: EncodeBase64ToolInputSchema,

  async execute(input: EncodeBase64ToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<EncodeBase64ToolOutput> {
    const { input: textToEncode } = input;

    try {
      console.log('Encoding to Base64...');
      // Test-specific error trigger (keeping for consistency with original)
      if (textToEncode === 'trigger error') {
        throw new Error('Simulated encoding error');
      }
      // In Node.js environment
      const encoded = Buffer.from(textToEncode, 'utf-8').toString('base64');
      console.log('Encoding successful.');
      return {
        success: true,
        encoded: encoded,
        content: [{ type: 'text', text: `Encoded result: ${encoded}` }],
      };
    } catch (e: any) {
      console.error(`Encoding failed: ${e.message}`);
      return {
        success: false,
        error: `Encoding failed: ${e.message}`,
        content: [],
      };
    }
  },
};

console.log('MCP Encode Base64 Tool Loaded');