import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import {
  type JsonInputItemSchema,
  type JsonOperationEnum,
  jsonToolInputSchema,
} from './jsonTool.schema.js'; // Import schemas (added .js)

// --- TypeScript Types ---
export type JsonOperation = z.infer<typeof JsonOperationEnum>;
export type JsonInputItem = z.infer<typeof JsonInputItemSchema>;
export type JsonToolInput = z.infer<typeof jsonToolInputSchema>;

// Interface for a single JSON result item
export interface JsonResultItem {
  id?: string; // Corresponds to input id if provided
  success: boolean;
  result?: unknown; // Parsed object or stringified JSON
  error?: string;
  suggestion?: string;
}

// Output interface for the tool (includes multiple results)
export interface JsonToolOutput extends BaseMcpToolOutput {
  results: JsonResultItem[];
  error?: string; // Optional overall error if the tool itself fails unexpectedly
}

// --- Helper Function ---

// Helper function to process a single JSON operation item
async function processSingleJson(item: JsonInputItem): Promise<JsonResultItem> {
  const { id, operation } = item;
  const resultItem: JsonResultItem = { id, success: false }; // Initialize success to false

  try {
    let operationResult: unknown;
    switch (operation) {
      case 'parse':
        operationResult = JSON.parse(item.data);
        break;

      case 'stringify':
        // Add options like space later: operationResult = JSON.stringify(item.data, null, item.space);
        operationResult = JSON.stringify(item.data);
        break;
    }

    resultItem.success = true;
    resultItem.result = operationResult;
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown JSON error';
    resultItem.error = `JSON operation '${operation}' failed: ${errorMsg}`;
    if (operation === 'parse') {
      resultItem.suggestion = 'Ensure input data is a valid JSON string.';
    } else if (operation === 'stringify') {
      resultItem.suggestion =
        'Ensure input data is serializable (no circular references, BigInts, etc.).';
    }
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const jsonTool = defineTool({
  name: 'json',
  description: 'Performs JSON operations (parse or stringify) on one or more inputs.',
  inputSchema: jsonToolInputSchema, // Schema expects { items: [...] }

  execute: async ( // Core logic passed to defineTool
    input: JsonToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<JsonToolOutput> => { // Still returns the specific output type

    // Input validation is handled by registerTools/SDK before execute is called
    const { items } = input;

    const results: JsonResultItem[] = [];
    let overallSuccess = true;

    // Removed the outermost try/catch block; defineTool handles unexpected errors

    // Process requests sequentially
    for (const item of items) {
      // processSingleJson already includes its own try/catch for JSON errors
      const result = await processSingleJson(item);
      results.push(result);
      if (!result.success) {
        overallSuccess = false; // Mark overall as failed if any item fails
      }
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Processed ${items.length} JSON operations. Overall success: ${overallSuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess,
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { JsonToolInput, JsonToolOutput, JsonResultItem, JsonInputItem, JsonOperation }; // Removed duplicate export
