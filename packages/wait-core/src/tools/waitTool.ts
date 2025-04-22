import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart } from '@sylphlab/mcp-core';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import { type WaitItemSchema, waitToolInputSchema } from './waitTool.schema';

// --- TypeScript Types ---
export type WaitInputItem = z.infer<typeof WaitItemSchema>;
export type WaitToolInput = z.infer<typeof waitToolInputSchema>;

// --- Output Types ---
// Interface for a single wait result item
export interface WaitResultItem {
  /** Optional ID from the input item. */
  id?: string;
  /** Whether the wait operation completed successfully. */
  success: boolean;
  /** The duration waited in milliseconds, if successful. */
  durationWaitedMs?: number;
  /** Error message, if the wait failed (unlikely for setTimeout). */
  error?: string;
}

// Zod Schema for the individual result
const WaitResultItemSchema = z.object({
  id: z.string().optional(),
  success: z.boolean(),
  durationWaitedMs: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});

// Define the output schema instance as a constant array
const WaitToolOutputSchema = z.array(WaitResultItemSchema);

// --- Helper Function ---

// Helper function to process a single wait item
async function processSingleWait(item: WaitInputItem): Promise<WaitResultItem> {
  const { id, durationMs } = item;
  const resultItem: WaitResultItem = { id, success: false };

  try {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    resultItem.success = true;
    resultItem.durationWaitedMs = durationMs;
  } catch (e: unknown) {
    // Unlikely to be hit for setTimeout
    resultItem.error = `Wait failed: ${e instanceof Error ? e.message : String(e)}`;
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const waitTool = defineTool({
  name: 'wait',
  description: 'Waits sequentially for one or more specified durations in milliseconds.',
  inputSchema: waitToolInputSchema,
  outputSchema: WaitToolOutputSchema, // Use the array schema

  execute: async (input: WaitToolInput, _options: McpToolExecuteOptions): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = waitToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items } = parsed.data;

    const results: WaitResultItem[] = [];

    // Process waits sequentially
    for (const item of items) {
      const result = await processSingleWait(item);
      results.push(result);
    }

    // Return the results wrapped in jsonPart
    return [jsonPart(results, WaitToolOutputSchema)];
  },
});

// Export necessary types
