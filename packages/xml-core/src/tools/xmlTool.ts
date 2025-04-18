import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

const XmlOperationEnum = z.enum(['parse']); // Add 'build' later

// Schema for a single XML operation item
const XmlInputItemSchema = z.object({
  id: z.string().optional(),
  operation: XmlOperationEnum,
  data: z.string({ required_error: 'Input data for "parse" operation must be a string.' }),
});

// Main input schema: an array of XML items
export const XmlToolInputSchema = z.object({
  items: z.array(XmlInputItemSchema).min(1, 'At least one XML operation item is required.'),
});

// --- TypeScript Types ---
export type XmlOperation = z.infer<typeof XmlOperationEnum>;
export type XmlInputItem = z.infer<typeof XmlInputItemSchema>;
export type XmlToolInput = z.infer<typeof XmlToolInputSchema>;

// Interface for a single XML result item
export interface XmlResultItem {
  id?: string;
  success: boolean;
  result?: any; // Parsed object (placeholder for now)
  error?: string;
  suggestion?: string;
}

// Output interface for the tool
export interface XmlToolOutput extends BaseMcpToolOutput {
  results: XmlResultItem[];
  error?: string; // Optional overall error
}

// --- Tool Definition ---

// Re-implement the core logic within the execute method
async function processSingleXml(item: XmlInputItem): Promise<XmlResultItem> {
  const { id, operation, data } = item; // data is guaranteed string by Zod
  const resultItem: XmlResultItem = { id, success: false };

  try {
    switch (operation) {
      case 'parse':
        console.log(`Parsing XML... (ID: ${id ?? 'N/A'})`);
        // Simple placeholder logic based on original function
        if (data.includes('<error>')) {
           throw new Error('Simulated XML parse error (contains <error> tag)');
        }
        // Placeholder: Replace with actual XML parsing library (e.g., fast-xml-parser)
        resultItem.result = { simulated: 'parsed_data_for_' + (id ?? data.substring(0,10)) };
        resultItem.success = true;
        console.log(`XML parsed successfully (simulated). (ID: ${id ?? 'N/A'})`);
        break;
      // No default needed due to Zod validation
    }
  } catch (e: any) {
    resultItem.error = `Operation '${operation}' failed: ${e.message}`;
    resultItem.suggestion = 'Ensure input is valid XML. Check for syntax errors.'; // Generic suggestion
    console.error(resultItem.error);
  }
  return resultItem;
}

export const xmlTool: McpTool<typeof XmlToolInputSchema, XmlToolOutput> = {
  name: 'xml',
  description: 'Performs XML operations (currently parse with placeholder logic).',
  inputSchema: XmlToolInputSchema,

  async execute(input: XmlToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<XmlToolOutput> {
    const { items } = input; // Input is validated by the server
    const results: XmlResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process sequentially
      for (const item of items) {
        const result = await Promise.resolve(processSingleXml(item));
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
        }
      }

      return {
        success: overallSuccess,
        results: results,
        content: [{ type: 'text', text: `Processed ${items.length} XML operations. Overall success: ${overallSuccess}` }],
      };
    } catch (e: any) {
      console.error(`Unexpected error during XML tool execution: ${e.message}`);
      return {
        success: false,
        results: results,
        error: `Unexpected tool error: ${e.message}`,
        content: [],
      };
    }
  },
};

console.log('MCP XML Tool Loaded');