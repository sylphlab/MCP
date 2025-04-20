import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, McpToolExecuteOptions } from '@sylphlab/mcp-core';

// --- Zod Schemas ---

export const XmlOperationEnum = z.enum(['parse']); // Add 'build' later

// Schema for a single XML operation item
const XmlInputItemSchema = z.object({
  id: z.string().optional(),
  operation: XmlOperationEnum,
  data: z.string({ required_error: 'Input data for "parse" operation must be a string.' }),
  // Add options for parsing/building later
});

// Main input schema: an array of XML operation items
export const XmlToolInputSchema = z.object({
  items: z.array(XmlInputItemSchema).min(1, 'At least one XML operation item is required.'),
});

// --- TypeScript Types ---
export type XmlOperation = z.infer<typeof XmlOperationEnum>;
export type XmlInputItem = z.infer<typeof XmlInputItemSchema>;
export type XmlToolInput = z.infer<typeof XmlToolInputSchema>;

// Interface for a single XML result item
export interface XmlResultItem {
  id?: string; // Corresponds to input id if provided
  success: boolean;
  result?: any; // Parsed object (placeholder for now)
  error?: string;
  suggestion?: string;
}

// Output interface for the tool (includes multiple results)
export interface XmlToolOutput extends BaseMcpToolOutput {
  results: XmlResultItem[];
  error?: string; // Optional overall error if the tool itself fails unexpectedly
}

// --- Helper Function ---

// Helper function to process a single XML operation item
async function processSingleXml(item: XmlInputItem): Promise<XmlResultItem> {
  const { id, operation, data } = item;
  const resultItem: XmlResultItem = { id, success: false };

  try {
    let operationResult: any;
    let suggestion: string | undefined;

    switch (operation) {
      case 'parse':
        console.log(`Parsing XML... (ID: ${id ?? 'N/A'})`);
        // Simple placeholder logic - check for opening error tag start
        if (data.includes('<error')) { // Changed to catch <error> or <error/>
           throw new Error('Simulated XML parse error (contains <error tag)');
        }
        // Placeholder: Replace with actual XML parsing library (e.g., fast-xml-parser)
        operationResult = { simulated: 'parsed_data_for_' + (id ?? data.substring(0,10)) };
        suggestion = 'Parsing simulated successfully. Replace with actual XML parser for real results.';
        console.log(`XML parsed successfully (simulated). (ID: ${id ?? 'N/A'})`);
        break;
      // No default needed due to Zod validation
    }

    resultItem.success = true;
    resultItem.result = operationResult;
    resultItem.suggestion = suggestion;

  } catch (e: any) {
    resultItem.error = `XML operation '${operation}' failed: ${e.message}`;
    resultItem.suggestion = 'Ensure input is valid XML. Check for syntax errors.'; // Generic suggestion
    console.error(`${resultItem.error} (ID: ${id ?? 'N/A'})`);
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}


// --- Tool Definition ---
export const xmlTool: McpTool<typeof XmlToolInputSchema, XmlToolOutput> = {
  name: 'xml',
  description: 'Performs XML operations (currently parse with placeholder logic) on one or more inputs.',
  inputSchema: XmlToolInputSchema, // Schema expects { items: [...] }

  async execute(input: XmlToolInput, options: McpToolExecuteOptions): Promise<XmlToolOutput> { // Remove workspaceRoot, require options
    // Input validation happens before execute in the registerTools helper
    const { items } = input;
    // workspaceRoot is now in options.workspaceRoot if needed
    const results: XmlResultItem[] = [];
    let overallSuccess = true;

    try {
      // Process requests sequentially
      for (const item of items) {
        const result = await processSingleXml(item); // Process each item
        results.push(result);
        if (!result.success) {
          overallSuccess = false;
        }
      }

      // Serialize the detailed results into the content field
      const contentText = JSON.stringify({
          summary: `Processed ${items.length} XML operations. Overall success: ${overallSuccess}`,
          results: results
      }, null, 2); // Pretty-print JSON

      return {
        success: overallSuccess,
        results: results, // Keep original results field too
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (e: any) {
      // Catch unexpected errors during the loop itself (should be rare)
      const errorMsg = `Unexpected error during XML tool execution: ${e.message}`;
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

console.log('MCP XML Core Tool (Batch Operation) Loaded');