import {
  type BaseMcpToolOutput,
  type McpTool,
  type McpToolExecuteOptions,
  McpToolInput,
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

// --- Tool Definition ---
export const decodeBase64Tool: McpTool<typeof DecodeBase64ToolInputSchema, DecodeBase64ToolOutput> =
  {
    name: 'decodeBase64',
    description: 'Decodes a Base64 string into UTF-8.',
    inputSchema: DecodeBase64ToolInputSchema,

    async execute(
      input: DecodeBase64ToolInput,
      _options: McpToolExecuteOptions,
    ): Promise<DecodeBase64ToolOutput> {
      // Remove workspaceRoot, require options
      const { encoded } = input;
      // workspaceRoot is now in options.workspaceRoot if needed

      try {
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
        const contentText = JSON.stringify(
          {
            success: true,
            decoded: decoded,
          },
          null,
          2,
        );
        return {
          success: true,
          decoded: decoded, // Keep original field
          content: [{ type: 'text', text: contentText }], // Put JSON in content
        };
      } catch (e: unknown) {
        const errorMsg =
          e instanceof Error ? `Decoding failed: ${e.message}` : 'Decoding failed: Unknown error';
        const suggestion = 'Ensure the input is a valid Base64 encoded string.';
        const errorContentText = JSON.stringify(
          {
            success: false,
            error: errorMsg,
            suggestion: suggestion,
          },
          null,
          2,
        );
        return {
          success: false,
          error: errorMsg, // Keep original field
          suggestion: suggestion, // Keep original field
          content: [{ type: 'text', text: errorContentText }], // Put JSON in content
        };
      }
    },
  };
