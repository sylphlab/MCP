import type { z } from 'zod';
import { type McpTool, type BaseMcpToolOutput, McpToolInput, type McpToolExecuteOptions } from '@sylphlab/mcp-core';
import { waitToolInputSchema, type WaitItemSchema } from './waitTool.schema'; // Import schema (fixed name)

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
    console.log(`Waiting for ${ms}ms... (ID: ${id ?? 'N/A'})`);
    await new Promise(resolve => setTimeout(resolve, ms));
    console.log(`Wait finished for ${ms}ms. (ID: ${id ?? 'N/A'})`);
    resultItem.success = true;
    resultItem.durationWaitedMs = item.durationMs; // Assign the original value from item
  } catch (e: any) {
    // This catch block is unlikely to be hit for setTimeout unless there's a very strange environment issue.
    resultItem.error = `Wait failed: ${e.message}`;
    console.error(`${resultItem.error} (ID: ${id ?? 'N/A'})`);
    resultItem.success = false;
  }
  return resultItem;
}


// --- Tool Definition ---
export const waitTool: McpTool<typeof waitToolInputSchema, WaitToolOutput> = {
  name: 'wait',
  description: 'Waits sequentially for one or more specified durations in milliseconds.',
  inputSchema: waitToolInputSchema, // Schema expects { items: [...] }

  async execute(input: WaitToolInput, options: McpToolExecuteOptions): Promise<WaitToolOutput> { // Remove workspaceRoot, require options
    // Input validation happens before execute in the registerTools helper
    const { items } = input;
    // workspaceRoot is now in options.workspaceRoot if needed
    const results: WaitResultItem[] = [];
    let overallSuccess = true;
    let totalWaited = 0;

    try {
      // Process waits sequentially
      for (const item of items) {
        const result = await processSingleWait(item); // Process each item
        results.push(result);
        // Check for success AND that durationWaitedMs is a number (including 0)
        if (result.success && typeof result.durationWaitedMs === 'number') {
          totalWaited += result.durationWaitedMs;
        } else if (!result.success) { // Only set overallSuccess to false if an item actually failed
          overallSuccess = false;
          // Optionally break here if one wait fails? For now, continue processing others.
        }
      }

      // Serialize the detailed results into the content field
      const contentText = JSON.stringify({
          summary: `Processed ${items.length} wait operations. Total duration waited: ${totalWaited}ms. Overall success: ${overallSuccess}`,
          totalDurationWaitedMs: totalWaited,
          results: results
      }, null, 2); // Pretty-print JSON

      return {
        success: overallSuccess,
        results: results, // Keep original results field too
        totalDurationWaitedMs: totalWaited, // Keep original field
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (e: any) {
      // Catch unexpected errors during the loop itself (should be rare)
      const errorMsg = `Unexpected error during wait tool execution: ${e.message}`;
      console.error(errorMsg);
      const errorContentText = JSON.stringify({
          error: errorMsg,
          totalDurationWaitedMs: totalWaited, // Include partial duration
          results: results // Include partial results in error content too
      }, null, 2);
      return {
        success: false,
        results: results, // Keep partial results here too
        totalDurationWaitedMs: totalWaited, // Keep partial duration here too
        error: errorMsg, // Keep top-level error
        content: [{ type: 'text', text: errorContentText }], // Put error JSON in content
      };
    }
  },
};

console.log('MCP Wait Core Tool (Batch Operation) Loaded');