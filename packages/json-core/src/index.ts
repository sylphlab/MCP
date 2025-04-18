// Define Input and Output structures for batch processing
type JsonOperation = 'parse' | 'stringify'; // Add 'diff', 'patch' later if needed

interface JsonInputItem {
  id?: string;
  operation: JsonOperation;
  data: any; // Input data (string for parse, object for stringify)
  // Add options for stringify (space, replacer), diff, patch later
}

interface JsonResultItem {
  id?: string;
  success: boolean;
  result?: any; // Parsed object or stringified JSON
  error?: string;
  suggestion?: string;
}

/**
 * Processes multiple JSON operations.
 * @param items An array of JsonInputItem objects.
 * @returns An array of JsonResultItem objects.
 */
export function processJsonOperations(items: JsonInputItem[]): JsonResultItem[] {
  const results: JsonResultItem[] = [];

  for (const item of items) {
    const { id, operation, data } = item;
    const resultItem: JsonResultItem = { id, success: false };

    try {
      switch (operation) {
        case 'parse':
          if (typeof data !== 'string') {
            throw new Error('Input data for "parse" operation must be a string.');
          }
          console.log(`Parsing JSON... (ID: ${id ?? 'N/A'})`);
          resultItem.result = JSON.parse(data);
          resultItem.success = true;
          console.log(`JSON parsed successfully. (ID: ${id ?? 'N/A'})`);
          break;

        case 'stringify':
          // Add options like space later
          console.log(`Stringifying data... (ID: ${id ?? 'N/A'})`);
          resultItem.result = JSON.stringify(data); // Basic stringify
          resultItem.success = true;
          console.log(`Data stringified successfully. (ID: ${id ?? 'N/A'})`);
          break;

        default:
          // const _exhaustiveCheck: never = operation;
          throw new Error(`Unsupported JSON operation: ${operation}`);
      }
    } catch (e: any) {
      resultItem.error = `Operation '${operation}' failed: ${e.message}`;
      if (operation === 'parse') {
        resultItem.suggestion = 'Ensure input data is a valid JSON string.';
      } else if (operation === 'stringify') {
         resultItem.suggestion = 'Ensure input data is serializable (no circular references, BigInts, etc.).';
      }
      // No need for a suggestion for the 'default' case as the error is explicit
    }
    results.push(resultItem);
  }

  return results;
}


console.log('MCP JSON Core Package Loaded');

export type { JsonInputItem, JsonResultItem, JsonOperation };
