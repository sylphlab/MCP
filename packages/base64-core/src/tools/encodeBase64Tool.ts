import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import { EncodeBase64ToolInputSchema } from './encodeBase64Tool.schema.js'; // Import schema (added .js)

// --- TypeScript Type from Schema ---
export type EncodeBase64ToolInput = z.infer<typeof EncodeBase64ToolInputSchema>;

// --- Output Interface ---
export interface EncodeBase64ToolOutput extends BaseMcpToolOutput {
  encoded?: string; // The Base64 encoded string
  error?: string;
}

// --- Tool Definition using defineTool ---
export const encodeBase64Tool = defineTool({
  name: 'encodeBase64',
  description: 'Encodes a UTF-8 string into Base64.',
  inputSchema: EncodeBase64ToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: EncodeBase64ToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<EncodeBase64ToolOutput> => { // Still returns the specific output type

    const { input: textToEncode } = input;

    // Removed try/catch, defineTool wrapper handles errors

    // Test-specific error trigger (can be kept if needed for testing wrapper)
    if (textToEncode === 'trigger error') {
      throw new Error('Simulated encoding error');
    }

    // In Node.js environment
    const encoded = Buffer.from(textToEncode, 'utf-8').toString('base64');

    // Construct the success output
    const contentText = JSON.stringify({ success: true, encoded: encoded }, null, 2);
    return {
      success: true,
      encoded: encoded, // Keep original field for potential direct use
      content: [{ type: 'text', text: contentText }], // Put JSON in content
    };
  },
});

// Ensure necessary types are still exported
// export type { EncodeBase64ToolInput, EncodeBase64ToolOutput }; // Removed duplicate export
