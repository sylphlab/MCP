import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
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
import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

// Since this tool only needs the base context, we provide BaseContextSchema.
// The generic parameters for defineTool are now inferred.
export const waitTool = defineTool({
  name: 'wait',
  description: 'Waits sequentially for one or more specified durations in milliseconds.',
  inputSchema: waitToolInputSchema,
  contextSchema: BaseContextSchema, // Add the base context schema
  // Use the array schema

  execute: async (
    // The context type is now correctly inferred from BaseContextSchema
    { args }: { context: ToolExecuteOptions; args: WaitToolInput } // Destructure args directly
  ): Promise<Part[]> => {
    // context is available if needed
    // Return Part[]

    // Zod validation (throw error on failure)
    // Validate args instead of the old input
    const parsed = waitToolInputSchema.safeParse(args);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    // Get items from parsed data (which comes from args)
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
