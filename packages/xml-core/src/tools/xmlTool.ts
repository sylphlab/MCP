import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

export const XmlOperationEnum = z.enum(['parse']); // Add 'build' later

// Input schema for a SINGLE XML operation
export const XmlToolInputSchema = z.object({
  id: z.string().optional(), // Keep id for correlation if used in batch by server
  operation: XmlOperationEnum,
  data: z.string({ required_error: 'Input data for "parse" operation must be a string.' }),
});

// --- TypeScript Types ---
export type XmlOperation = z.infer<typeof XmlOperationEnum>;
export type XmlToolInput = z.infer<typeof XmlToolInputSchema>;

// Output interface for a SINGLE XML result
export interface XmlToolOutput extends BaseMcpToolOutput {
  // BaseMcpToolOutput provides 'success' and 'content'
  id?: string; // Corresponds to input id if provided
  result?: any; // Parsed object (placeholder for now)
  error?: string;
  suggestion?: string;
}

// --- Tool Definition ---
export const xmlTool: McpTool<typeof XmlToolInputSchema, XmlToolOutput> = {
  name: 'xml', // Represents the capability (parse)
  description: 'Performs an XML operation (currently parse with placeholder logic) on a single input.',
  inputSchema: XmlToolInputSchema, // Schema for single item

  async execute(input: XmlToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<XmlToolOutput> {
    // Logic now directly processes the single 'input' object.
    const { id, operation, data } = input; // data is guaranteed string by Zod

    try {
      let operationResult: any;
      let suggestion: string | undefined;

      switch (operation) {
        case 'parse':
          console.log(`Parsing XML... (ID: ${id ?? 'N/A'})`);
          // Simple placeholder logic based on original function
          if (data.includes('<error>')) {
             throw new Error('Simulated XML parse error (contains <error> tag)');
          }
          // Placeholder: Replace with actual XML parsing library (e.g., fast-xml-parser)
          operationResult = { simulated: 'parsed_data_for_' + (id ?? data.substring(0,10)) };
          suggestion = 'Parsing simulated successfully. Replace with actual XML parser for real results.';
          console.log(`XML parsed successfully (simulated). (ID: ${id ?? 'N/A'})`);
          break;
        // No default needed due to Zod validation
      }

      return {
        success: true,
        id: id,
        result: operationResult,
        content: [{ type: 'text', text: `XML operation '${operation}' successful (simulated).` }],
        suggestion: suggestion,
      };

    } catch (e: any) {
      const errorMsg = `XML operation '${operation}' failed: ${e.message}`;
      console.error(errorMsg);
      return {
        success: false,
        id: id,
        error: errorMsg,
        suggestion: 'Ensure input is valid XML. Check for syntax errors.', // Generic suggestion
        content: [],
      };
    }
  },
};

console.log('MCP XML Tool (Single Operation) Loaded');