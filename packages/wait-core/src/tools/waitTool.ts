import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import { type WaitItemSchema, waitToolInputSchema } from './waitTool.schema'; // Import schema (fixed name)

// --- TypeScript Types ---
export type WaitInputItem = z.infer<typeof WaitItemSchema>; // Use correct schema name
export type WaitToolInput = z.infer<typeof waitToolInputSchema>;

// Interface for a single wait result item
export interface WaitResultItem {
  id?: string;
  success: boolean;
  durationWaitedMs?: number;
  error?: string;
  // No suggestion needed for wait
}

// Output interface for the tool (includes multiple results)
export interface WaitToolOutput extends BaseMcpToolOutput {
  results: WaitResultItem[];
  totalDurationWaitedMs?: number; // Sum of successful waits
  error?: string; // Optional overall error if the tool itself fails unexpectedly
}

// --- Helper Function ---

// Helper function to process a single wait item
async function processSingleWait(item: WaitInputItem): Promise<WaitResultItem> {
  const { id, durationMs: ms } = item; // Destructure with rename
  const resultItem: WaitResultItem = { id, success: false };

  try {
    await new Promise((resolve) => setTimeout(resolve, ms));
    resultItem.success = true;
    resultItem.durationWaitedMs = item.durationMs; // Assign the original value from item
  } catch (e: unknown) {
    // This catch block is unlikely to be hit for setTimeout unless there's a very strange environment issue.
    resultItem.error = `Wait failed: ${e instanceof Error ? e.message : String(e)}`;
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const waitTool = defineTool({
  name: 'wait',
  description: 'Waits sequentially for one or more specified durations in milliseconds.',
  inputSchema: waitToolInputSchema, // Schema expects { items: [...] }

  execute: async ( // Core logic passed to defineTool
    input: WaitToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<WaitToolOutput> => { // Still returns the specific output type

    // Input validation is handled by registerTools/SDK
    const { items } = input;

    const results: WaitResultItem[] = [];
    let overallSuccess = true;
    let totalWaited = 0;

    // Removed the outermost try/catch block; defineTool handles unexpected errors

    // Process waits sequentially
    for (const item of items) {
      // processSingleWait handles its own errors (though unlikely for setTimeout)
      const result = await processSingleWait(item);
      results.push(result);
      if (result.success && typeof result.durationWaitedMs === 'number') {
        totalWaited += result.durationWaitedMs;
      } else if (!result.success) {
        overallSuccess = false; // Mark overall as failed if any item fails
      }
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Processed ${items.length} wait operations. Total duration waited: ${totalWaited}ms. Overall success: ${overallSuccess}`,
        totalDurationWaitedMs: totalWaited,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess,
      results: results,
      totalDurationWaitedMs: totalWaited, // Keep original field
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { WaitToolInput, WaitToolOutput, WaitResultItem, WaitInputItem }; // Removed duplicate export
