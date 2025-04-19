import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

export const JsonOperationEnum = z.enum(['parse', 'stringify']);

// Input schema for a SINGLE JSON operation
// Use discriminated union for type safety based on operation
export const JsonToolInputSchema = z.discriminatedUnion('operation', [
  z.object({
    id: z.string().optional(), // Keep id for correlation if used in batch by server
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

// --- TypeScript Types ---
export type JsonOperation = z.infer<typeof JsonOperationEnum>;
export type JsonToolInput = z.infer<typeof JsonToolInputSchema>;

// Output interface for a SINGLE JSON result
export interface JsonToolOutput extends BaseMcpToolOutput {
  // BaseMcpToolOutput provides 'success' and 'content'
  id?: string; // Corresponds to input id if provided
  result?: any; // Parsed object or stringified JSON
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---
export const jsonTool: McpTool<typeof JsonToolInputSchema, JsonToolOutput> = {
  name: 'json', // Represents the capability (parse/stringify)
  description: 'Performs a JSON operation (parse or stringify) on a single input.',
  inputSchema: JsonToolInputSchema, // Schema for single item

  async execute(input: JsonToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<JsonToolOutput> {
    // Logic now directly processes the single 'input' object.
    const { id, operation } = input; // data is accessed based on operation type

    try {
      let operationResult: any;
      switch (operation) {
        case 'parse':
          // data is guaranteed to be string by Zod schema
          console.log(`Parsing JSON... (ID: ${id ?? 'N/A'})`);
          operationResult = JSON.parse(input.data);
          console.log(`JSON parsed successfully. (ID: ${id ?? 'N/A'})`);
          break;

        case 'stringify':
          // data is any
          console.log(`Stringifying data... (ID: ${id ?? 'N/A'})`);
          // Add options like space later: operationResult = JSON.stringify(input.data, null, input.space);
          operationResult = JSON.stringify(input.data);
          console.log(`Data stringified successfully. (ID: ${id ?? 'N/A'})`);
          break;
      }

      return {
        success: true,
        id: id,
        result: operationResult,
        content: [{ type: 'text', text: `JSON ${operation} successful.` }],
      };

    } catch (e: any) {
      const errorMsg = `JSON operation '${operation}' failed: ${e.message}`;
      let suggestion: string | undefined;
      if (operation === 'parse') {
        suggestion = 'Ensure input data is a valid JSON string.';
      } else if (operation === 'stringify') {
         suggestion = 'Ensure input data is serializable (no circular references, BigInts, etc.).';
      }
      console.error(errorMsg);
      return {
        success: false,
        id: id,
        error: errorMsg,
        suggestion: suggestion,
        content: [],
      };
    }
  },
};

console.log('MCP JSON Tool (Single Operation) Loaded');