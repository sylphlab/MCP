import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import {
  type XmlInputItemSchema,
  type XmlOperationEnum,
  xmlToolInputSchema,
} from './xmlTool.schema'; // Import schema

// --- TypeScript Types ---
export type XmlOperation = z.infer<typeof XmlOperationEnum>;
export type XmlInputItem = z.infer<typeof XmlInputItemSchema>;
export type XmlToolInput = z.infer<typeof xmlToolInputSchema>;

// Interface for a single XML result item
export interface XmlResultItem {
  id?: string; // Corresponds to input id if provided
  success: boolean;
  result?: unknown; // Parsed object (placeholder for now)
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
    let operationResult: unknown;
    let suggestion: string | undefined;

    switch (operation) {
      case 'parse':
        // Simple placeholder logic - check for opening error tag start
        if (data.includes('<error')) {
          // Changed to catch <error> or <error/>
          throw new Error('Simulated XML parse error (contains <error tag)');
        }
        // Placeholder: Replace with actual XML parsing library (e.g., fast-xml-parser)
        operationResult = { simulated: `parsed_data_for_${id ?? data.substring(0, 10)}` };
        suggestion =
          'Parsing simulated successfully. Replace with actual XML parser for real results.';
        break;
      // No default needed due to Zod validation
    }

    resultItem.success = true;
    resultItem.result = operationResult;
    resultItem.suggestion = suggestion;
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    resultItem.error = `XML operation '${operation}' failed: ${errorMsg}`;
    resultItem.suggestion = 'Ensure input is valid XML. Check for syntax errors.'; // Generic suggestion
    // Ensure success is false if an error occurred
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const xmlTool = defineTool({
  name: 'xml',
  description:
    'Performs XML operations (currently parse with placeholder logic) on one or more inputs.',
  inputSchema: xmlToolInputSchema, // Schema expects { items: [...] }

  execute: async ( // Core logic passed to defineTool
    input: XmlToolInput,
    _options: McpToolExecuteOptions, // Options might be used by defineTool wrapper
  ): Promise<XmlToolOutput> => { // Still returns the specific output type

    // Input validation is handled by registerTools/SDK
    const { items } = input;

    const results: XmlResultItem[] = [];
    let overallSuccess = true;

    // Removed the outermost try/catch block; defineTool handles unexpected errors

    // Process requests sequentially
    for (const item of items) {
      // processSingleXml handles its own errors for XML operations
      const result = await processSingleXml(item);
      results.push(result);
      if (!result.success) {
        overallSuccess = false; // Mark overall as failed if any item fails
      }
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Processed ${items.length} XML operations. Overall success: ${overallSuccess}`,
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
// export type { XmlToolInput, XmlToolOutput, XmlResultItem, XmlInputItem, XmlOperation }; // Removed duplicate export
