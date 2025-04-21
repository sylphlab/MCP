import {
  type BaseMcpToolOutput,
  type McpTool,
  type McpToolExecuteOptions,
  McpToolInput,
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

// --- Tool Definition ---
export const jsonTool: McpTool<typeof jsonToolInputSchema, JsonToolOutput> = {
  name: 'json',
  description: 'Performs JSON operations (parse or stringify) on one or more inputs.',
  inputSchema: jsonToolInputSchema, // Schema expects { items: [...] }

  async execute(input: JsonToolInput, _options: McpToolExecuteOptions): Promise<JsonToolOutput> {
    // Remove workspaceRoot, require options
    // Input validation happens before execute in the registerTools helper
    const { items } = input;
    // workspaceRoot is now in options.workspaceRoot if needed
    const results: JsonResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process requests sequentially
      for (const item of items) {
        const result = await processSingleJson(item); // Process each item
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
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
      ); // Pretty-print JSON

      return {
        success: overallSuccess,
        results: results, // Keep original results field too
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (e: unknown) {
      // Catch unexpected errors during the loop itself (should be rare)
      const errorMsg =
        e instanceof Error
          ? `Unexpected error during JSON tool execution: ${e.message}`
          : 'Unexpected error during JSON tool execution: Unknown error';
      const errorContentText = JSON.stringify(
        {
          error: errorMsg,
          results: results, // Include partial results in error content too
        },
        null,
        2,
      );
      return {
        success: false,
        results: results, // Keep partial results here too
        error: errorMsg, // Keep top-level error
        content: [{ type: 'text', text: errorContentText }], // Put error JSON in content
      };
    }
  },
};
