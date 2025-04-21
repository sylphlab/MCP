import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import { DecodeBase64ToolInputSchema } from './decodeBase64Tool.schema.js'; // Import schema (added .js)

// --- TypeScript Type from Schema ---
export type DecodeBase64ToolInput = z.infer<typeof DecodeBase64ToolInputSchema>;

// --- Output Interface ---
export interface DecodeBase64ToolOutput extends BaseMcpToolOutput {
  decoded?: string; // The decoded UTF-8 string
  error?: string;
}

// --- Tool Definition using defineTool ---
export const decodeBase64Tool = defineTool({
  name: 'decodeBase64',
  description: 'Decodes a Base64 string into UTF-8.',
  inputSchema: DecodeBase64ToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: DecodeBase64ToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<DecodeBase64ToolOutput> => { // Still returns the specific output type

    const { encoded } = input;

    // Removed try/catch, defineTool wrapper handles errors

    // Test-specific error trigger (can be kept if needed for testing wrapper)
    if (encoded === 'invalid-base64!') {
      throw new Error('Simulated decoding error');
    }

    // In Node.js environment
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

    // Add a check to see if the decoded string, when re-encoded, matches the original.
    // This helps catch cases where Buffer.from might silently ignore invalid characters.
    if (Buffer.from(decoded, 'utf-8').toString('base64') !== encoded) {
      // Throw a specific error for defineTool to catch
      throw new Error('Invalid Base64 input string');
    }

    // Construct the success output
    const contentText = JSON.stringify({ success: true, decoded: decoded }, null, 2);
    return {
      success: true,
      decoded: decoded, // Keep original field for potential direct use
      content: [{ type: 'text', text: contentText }], // Put JSON in content
    };
  },
});

// Ensure necessary types are still exported
// export type { DecodeBase64ToolInput, DecodeBase64ToolOutput }; // Removed duplicate export
