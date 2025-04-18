import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schema for Input ---
export const WaitToolInputSchema = z.object({
  ms: z.number().int().min(0, 'Milliseconds must be a non-negative integer.'),
});

// --- TypeScript Type from Schema ---
export type WaitToolInput = z.infer<typeof WaitToolInputSchema>;

// --- Output Interface ---
// Extending BaseMcpToolOutput which includes 'success: boolean' and 'content: McpToolOutputContentItem[]'
export interface WaitToolOutput extends BaseMcpToolOutput {
  message?: string; // Optional message confirming wait duration
  error?: string; // Optional error message
}

// --- Tool Definition ---
export const waitTool: McpTool<typeof WaitToolInputSchema, WaitToolOutput> = {
  name: 'wait', // Simple name matching the core function
  description: 'Waits for a specified duration in milliseconds.',
  inputSchema: WaitToolInputSchema,

  async execute(input: WaitToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<WaitToolOutput> {
    // Input is already validated by the MCP server using the schema
    const { ms } = input;

    try {
      console.log(`Waiting for ${ms}ms...`);
      await new Promise(resolve => setTimeout(resolve, ms));
      console.log('Wait finished.');
      return {
        success: true,
        message: `Successfully waited for ${ms}ms.`,
        content: [{ type: 'text', text: `Successfully waited for ${ms}ms.` }],
      };
    } catch (e: any) {
      console.error(`Wait tool failed: ${e.message}`);
      return {
        success: false,
        error: `Wait failed: ${e.message}`,
        content: [], // No content on failure
      };
    }
  },
};

console.log('MCP Wait Tool Loaded'); // Log when the tool module is loaded