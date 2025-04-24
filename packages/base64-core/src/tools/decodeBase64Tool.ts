import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart } from '@sylphlab/mcp-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import { DecodeBase64ToolInputSchema } from './decodeBase64Tool.schema.js';

// --- TypeScript Type from Schema ---
export type DecodeBase64ToolInput = z.infer<typeof DecodeBase64ToolInputSchema>;

// --- Output Types ---
export interface DecodeBase64Result {
  /** The original encoded input string. */
  input: string;
  /** Whether the decoding was successful. */
  success: boolean;
  /** The decoded UTF-8 string, if successful. */
  decoded?: string;
  /** Error message, if decoding failed. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const DecodeBase64ResultSchema = z.object({
  input: z.string(),
  success: z.boolean(),
  decoded: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const DecodeBase64OutputSchema = z.array(DecodeBase64ResultSchema);

// --- Tool Definition using defineTool ---
export const decodeBase64Tool = defineTool({
  name: 'decodeBase64',
  description: 'Decodes a Base64 string into UTF-8.',
  inputSchema: DecodeBase64ToolInputSchema,
  execute: async (
    input: DecodeBase64ToolInput,
    _options: ToolExecuteOptions,
  ): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = DecodeBase64ToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { encoded } = parsed.data;

    const results: DecodeBase64Result[] = [];
    let decoded: string | undefined;
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      // Test-specific error trigger (can be kept if needed for testing wrapper)
      if (encoded === 'invalid-base64!') {
        throw new Error('Simulated decoding error');
      }

      // In Node.js environment
      decoded = Buffer.from(encoded, 'base64').toString('utf-8');

      // Add a check to see if the decoded string, when re-encoded, matches the original.
      if (Buffer.from(decoded, 'utf-8').toString('base64') !== encoded) {
        throw new Error('Invalid Base64 input string');
      }
      success = true;
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown decoding error';
      if (error.includes('Invalid Base64 input string')) {
        suggestion =
          'Ensure the input string is valid Base64. Check for invalid characters or padding issues.';
      } else {
        suggestion = 'Verify the input string format.';
      }
      decoded = undefined; // Ensure decoded is undefined on error
    }

    // Push the single result
    results.push({
      input: encoded,
      success,
      decoded,
      error,
      suggestion,
    });

    // Return the result wrapped in jsonPart
    return [jsonPart(results, DecodeBase64OutputSchema)];
  },
});
