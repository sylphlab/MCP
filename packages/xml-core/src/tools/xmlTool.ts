import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart } from '@sylphlab/mcp-core';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import {
  type XmlInputItemSchema,
  type XmlOperationEnum,
  xmlToolInputSchema,
} from './xmlTool.schema';

// --- TypeScript Types ---
export type XmlOperation = z.infer<typeof XmlOperationEnum>;
export type XmlInputItem = z.infer<typeof XmlInputItemSchema>;
export type XmlToolInput = z.infer<typeof xmlToolInputSchema>;

// --- Output Types ---
// Interface for a single XML result item
export interface XmlResultItem {
  /** Optional ID from the input item. */
  id?: string;
  /** Whether the XML operation for this item was successful. */
  success: boolean;
  /** The result of the operation (e.g., parsed object - currently placeholder), if successful. */
  result?: unknown;
  /** Error message, if the operation failed for this item. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const XmlResultItemSchema = z.object({
  id: z.string().optional(),
  success: z.boolean(),
  result: z.unknown().optional(), // Placeholder uses object, keep unknown
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const XmlToolOutputSchema = z.array(XmlResultItemSchema);

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
        // Simple placeholder logic
        if (data.includes('<error')) {
          throw new Error('Simulated XML parse error (contains <error tag)');
        }
        // Placeholder: Replace with actual XML parsing library
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
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const xmlTool = defineTool({
  name: 'xml',
  description:
    'Performs XML operations (currently parse with placeholder logic) on one or more inputs.',
  inputSchema: xmlToolInputSchema,
  outputSchema: XmlToolOutputSchema, // Use the array schema

  execute: async (input: XmlToolInput, _options: McpToolExecuteOptions): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = xmlToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items } = parsed.data;

    const results: XmlResultItem[] = [];

    // Process requests sequentially
    for (const item of items) {
      const result = await processSingleXml(item);
      results.push(result);
    }

    // Return the results wrapped in jsonPart
    return [jsonPart(results, XmlToolOutputSchema)];
  },
});

// Export necessary types
