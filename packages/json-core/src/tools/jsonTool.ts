import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

export const JsonOperationEnum = z.enum(['parse', 'stringify']);

// Schema for a single JSON operation item
const JsonInputItemSchema = z.discriminatedUnion('operation', [
  z.object({
    id: z.string().optional(),
    operation: z.literal('parse'),
    data: z.string({ required_error: 'Input data for "parse" operation must be a string.' }),
  }),
  z.object({
    id: z.string().optional(),
    operation: z.literal('stringify'),
    data: z.any(), // Allow any serializable data for stringify
    // Add options like space later: space: z.union([z.string(), z.number()]).optional(),
  }),
]);

// Main input schema: an array of JSON operation items
export const JsonToolInputSchema = z.object({
  items: z.array(JsonInputItemSchema).min(1, 'At least one JSON operation item is required.'),
});


// --- TypeScript Types ---
export type JsonOperation = z.infer<typeof JsonOperationEnum>;
export type JsonInputItem = z.infer<typeof JsonInputItemSchema>;
export type JsonToolInput = z.infer<typeof JsonToolInputSchema>;

// Interface for a single JSON result item
export interface JsonResultItem {
  id?: string; // Corresponds to input id if provided
  success: boolean;
  result?: any; // Parsed object or stringified JSON
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
    let operationResult: any;
    switch (operation) {
      case 'parse':
        // data is guaranteed to be string by Zod schema
        console.log(`Parsing JSON... (ID: ${id ?? 'N/A'})`);
        operationResult = JSON.parse(item.data);
        console.log(`JSON parsed successfully. (ID: ${id ?? 'N/A'})`);
        break;

      case 'stringify':
        // data is any
        console.log(`Stringifying data... (ID: ${id ?? 'N/A'})`);
        // Add options like space later: operationResult = JSON.stringify(item.data, null, item.space);
        operationResult = JSON.stringify(item.data);
        console.log(`Data stringified successfully. (ID: ${id ?? 'N/A'})`);
        break;
    }

    resultItem.success = true;
    resultItem.result = operationResult;

  } catch (e: any) {
    resultItem.error = `JSON operation '${operation}' failed: ${e.message}`;
    if (operation === 'parse') {
      resultItem.suggestion = 'Ensure input data is a valid JSON string.';
    } else if (operation === 'stringify') {
       resultItem.suggestion = 'Ensure input data is serializable (no circular references, BigInts, etc.).';
    }
    console.error(`${resultItem.error} (ID: ${id ?? 'N/A'})`);
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}


// --- Tool Definition ---
export const jsonTool: McpTool<typeof JsonToolInputSchema, JsonToolOutput> = {
  name: 'json',
  description: 'Performs JSON operations (parse or stringify) on one or more inputs.',
  inputSchema: JsonToolInputSchema, // Schema expects { items: [...] }

  async execute(input: JsonToolInput, options: McpToolExecuteOptions): Promise<JsonToolOutput> { // Remove workspaceRoot, require options
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
      const contentText = JSON.stringify({
          summary: `Processed ${items.length} JSON operations. Overall success: ${overallSuccess}`,
          results: results
      }, null, 2); // Pretty-print JSON

      return {
        success: overallSuccess,
        results: results, // Keep original results field too
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (e: any) {
      // Catch unexpected errors during the loop itself (should be rare)
      const errorMsg = `Unexpected error during JSON tool execution: ${e.message}`;
      console.error(errorMsg);
      const errorContentText = JSON.stringify({
          error: errorMsg,
          results: results // Include partial results in error content too
      }, null, 2);
      return {
        success: false,
        results: results, // Keep partial results here too
        error: errorMsg, // Keep top-level error
        content: [{ type: 'text', text: errorContentText }], // Put error JSON in content
      };
    }
  },
};

console.log('MCP JSON Core Tool (Batch Operation) Loaded');