import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import {
  type JsonInputItemSchema,
  type JsonOperationEnum,
  jsonToolInputSchema,
} from './jsonTool.schema.js';

// --- TypeScript Types ---
export type JsonOperation = z.infer<typeof JsonOperationEnum>;
export type JsonInputItem = z.infer<typeof JsonInputItemSchema>;
export type JsonToolInput = z.infer<typeof jsonToolInputSchema>;

// --- Output Types ---
// Interface for a single JSON result item
export interface JsonResultItem {
  /** Optional ID from the input item. */
  id?: string;
  /** Whether the JSON operation for this item was successful. */
  success: boolean;
  /** The result of the operation (parsed object or stringified JSON), if successful. */
  result?: unknown;
  /** Error message, if the operation failed for this item. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const JsonResultItemSchema = z.object({
  id: z.string().optional(),
  success: z.boolean(),
  result: z.unknown().optional(), // Use z.unknown() for potentially complex JSON objects
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const JsonToolOutputSchema = z.array(JsonResultItemSchema);

// --- Helper Function ---

// Helper function to process a single JSON operation item
async function processSingleJson(item: JsonInputItem): Promise<JsonResultItem> {
  const { id, operation } = item;
  const resultItem: JsonResultItem = { id, success: false };

  try {
    let operationResult: unknown;
    switch (operation) {
      case 'parse':
        if (typeof item.data !== 'string') {
          // This should ideally be caught by input schema validation, but double-check
          throw new Error('Input data for parse operation must be a string.');
        }
        operationResult = JSON.parse(item.data);
        break;

      case 'stringify':
        // Add options like space later if needed in schema
        operationResult = JSON.stringify(item.data);
        break;
      // default: // Should be unreachable due to schema validation
      //   throw new Error(`Unsupported JSON operation: ${operation}`);
    }

    resultItem.success = true;
    resultItem.result = operationResult;
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown JSON error';
    resultItem.error = `JSON operation '${operation}' failed: ${errorMsg}`;
    if (operation === 'parse') {
      resultItem.suggestion =
        'Ensure input data is a valid JSON string. Check for syntax errors like missing quotes or commas.';
    } else if (operation === 'stringify') {
      resultItem.suggestion =
        'Ensure input data is serializable (no circular references, BigInts, etc.). Check the structure of the object.';
    }
    resultItem.success = false;
  }
  return resultItem;
}

// --- Tool Definition using defineTool ---
export const jsonTool = defineTool({
  name: 'json',
  description: 'Performs JSON operations (parse or stringify) on one or more inputs.',
  inputSchema: jsonToolInputSchema,
  // Use the array schema

  execute: async (input: JsonToolInput, _options: ToolExecuteOptions): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = jsonToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items } = parsed.data;

    const results: JsonResultItem[] = [];

    // Process requests sequentially (or could be parallelized)
    for (const item of items) {
      const result = await processSingleJson(item);
      results.push(result);
    }

    // Return the results wrapped in jsonPart
    return [jsonPart(results, JsonToolOutputSchema)];
  },
});
