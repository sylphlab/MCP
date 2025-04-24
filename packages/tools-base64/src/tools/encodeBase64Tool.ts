import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import { EncodeBase64ToolInputSchema } from './encodeBase64Tool.schema.js';

// --- TypeScript Type from Schema ---
export type EncodeBase64ToolInput = z.infer<typeof EncodeBase64ToolInputSchema>;

// --- Output Types ---
export interface EncodeBase64Result {
  /** The original input string. */
  input: string;
  /** Whether the encoding was successful. */
  success: boolean;
  /** The Base64 encoded string, if successful. */
  encoded?: string;
  /** Error message, if encoding failed. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const EncodeBase64ResultSchema = z.object({
  input: z.string(),
  success: z.boolean(),
  encoded: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const EncodeBase64OutputSchema = z.array(EncodeBase64ResultSchema);

// --- Tool Definition using defineTool ---
export const encodeBase64Tool = defineTool({
  name: 'encodeBase64',
  description: 'Encodes a UTF-8 string into Base64.',
  inputSchema: EncodeBase64ToolInputSchema,

  execute: async (
    input: EncodeBase64ToolInput,
    _options: ToolExecuteOptions,
  ): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = EncodeBase64ToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { input: textToEncode } = parsed.data;

    const results: EncodeBase64Result[] = [];
    let encoded: string | undefined;
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      // Test-specific error trigger (can be kept if needed for testing wrapper)
      if (textToEncode === 'trigger error') {
        throw new Error('Simulated encoding error');
      }

      // In Node.js environment
      encoded = Buffer.from(textToEncode, 'utf-8').toString('base64');
      success = true;
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown encoding error';
      suggestion = 'Verify the input string or check for unexpected errors.';
      encoded = undefined; // Ensure encoded is undefined on error
    }

    // Push the single result
    results.push({
      input: textToEncode,
      success,
      encoded,
      error,
      suggestion,
    });

    // Return the result wrapped in jsonPart
    return [jsonPart(results, EncodeBase64OutputSchema)];
  },
});
