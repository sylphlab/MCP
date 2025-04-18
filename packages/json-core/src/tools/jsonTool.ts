import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

const JsonOperationEnum = z.enum(['parse', 'stringify']);

// Schema for a single JSON operation item
// Use discriminated union for type safety based on operation
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

// Main input schema: an array of JSON items
export const JsonToolInputSchema = z.object({
  items: z.array(JsonInputItemSchema).min(1, 'At least one JSON operation item is required.'),
});

// --- TypeScript Types ---
export type JsonOperation = z.infer<typeof JsonOperationEnum>;
export type JsonInputItem = z.infer<typeof JsonInputItemSchema>;
export type JsonToolInput = z.infer<typeof JsonToolInputSchema>;

// Interface for a single JSON result item
export interface JsonResultItem {
  id?: string;
  success: boolean;
  result?: any; // Parsed object or stringified JSON
  error?: string;
  suggestion?: string;
}

// Output interface for the tool
export interface JsonToolOutput extends BaseMcpToolOutput {
  results: JsonResultItem[];
  error?: string; // Optional overall error
}

// --- Tool Definition ---

// Re-implement the core logic within the execute method
async function processSingleJson(item: JsonInputItem): Promise<JsonResultItem> {
  const { id, operation } = item; // data is accessed based on operation type
  const resultItem: JsonResultItem = { id, success: false };

  try {
    switch (operation) {
      case 'parse':
        // data is guaranteed to be string by Zod schema
        console.log(`Parsing JSON... (ID: ${id ?? 'N/A'})`);
        resultItem.result = JSON.parse(item.data);
        resultItem.success = true;
        console.log(`JSON parsed successfully. (ID: ${id ?? 'N/A'})`);
        break;

      case 'stringify':
        // data is any
        console.log(`Stringifying data... (ID: ${id ?? 'N/A'})`);
        // Add options like space later: resultItem.result = JSON.stringify(item.data, null, item.space);
        resultItem.result = JSON.stringify(item.data);
        resultItem.success = true;
        console.log(`Data stringified successfully. (ID: ${id ?? 'N/A'})`);
        break;

      // No default needed due to discriminated union and Zod validation
    }
  } catch (e: any) {
    resultItem.error = `Operation '${operation}' failed: ${e.message}`;
    if (operation === 'parse') {
      resultItem.suggestion = 'Ensure input data is a valid JSON string.';
    } else if (operation === 'stringify') {
       resultItem.suggestion = 'Ensure input data is serializable (no circular references, BigInts, etc.).';
    }
    console.error(resultItem.error);
  }
  return resultItem;
}

export const jsonTool: McpTool<typeof JsonToolInputSchema, JsonToolOutput> = {
  name: 'json',
  description: 'Performs JSON operations (parse, stringify) on one or more inputs.',
  inputSchema: JsonToolInputSchema,

  async execute(input: JsonToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<JsonToolOutput> {
    const { items } = input; // Input is validated by the server
    const results: JsonResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process sequentially
      for (const item of items) {
        const result = await Promise.resolve(processSingleJson(item)); // Wrap in resolve for consistency
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
        }
      }

      return {
        success: overallSuccess,
        results: results,
        content: [{ type: 'text', text: `Processed ${items.length} JSON operations. Overall success: ${overallSuccess}` }],
      };
    } catch (e: any) {
      console.error(`Unexpected error during JSON tool execution: ${e.message}`);
      return {
        success: false,
        results: results,
        error: `Unexpected tool error: ${e.message}`,
        content: [],
      };
    }
  },
};

console.log('MCP JSON Tool Loaded');