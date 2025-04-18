import {
  McpTool,
  McpToolExecuteOptions,
  McpToolSchema // Assuming this exists for schema definition
} from '@sylphlab/mcp-core'; // Adjust import path if needed
import {
  processReadOperations,
  ReaderInputItem,
  ReaderResultItem,
  ReadOperation
} from '@sylphlab/mcp-reader-core';

// Define the input schema based on ReaderInputItem[]
const readerToolSchema: McpToolSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Optional identifier for the operation' },
      operation: {
        type: 'string',
        enum: ['readPdfText'], // Keep enum updated with supported operations
        description: 'The read operation to perform'
      },
      filePath: { type: 'string', description: 'Path to the file relative to workspace root' }
      // Add other ReaderInputItem properties if they exist
    },
    required: ['operation', 'filePath'],
    additionalProperties: false // Or true if extra props are allowed
  },
  description: 'An array of read operations to perform.'
};


const readerTool: McpTool = {
  name: 'reader',
  description: 'Reads content from files, supporting various formats like PDF text extraction.',
  inputSchema: readerToolSchema,
  // outputSchema: Define if needed, likely based on ReaderResultItem[]

  async execute(args: unknown, options?: McpToolExecuteOptions): Promise<ReaderResultItem[]> {
    // 1. Validate args against schema (framework might do this, but good practice)
    // For now, assume args are valid ReaderInputItem[]
    const items = args as ReaderInputItem[];

    // 2. Extract necessary options
    const workspaceRoot = options?.workspaceRoot;
    const allowOutsideWorkspace = options?.allowOutsideWorkspace ?? false; // Default to false

    if (!workspaceRoot) {
      // This should ideally be handled by the MCP framework ensuring options are provided
      throw new Error('Workspace root is required but was not provided in options.');
    }

    // 3. Call the core processing function
    try {
      console.log(`Executing reader tool with ${items.length} items. Allow outside: ${allowOutsideWorkspace}`);
      const results = await processReadOperations(items, workspaceRoot, { allowOutsideWorkspace });
      console.log(`Reader tool execution finished.`);
      return results;
    } catch (error: any) {
      console.error('Error executing reader tool:', error);
      // Re-throw or format error as needed for MCP response
      // Potentially return a generic error result for all items if the core function throws globally
       return items.map(item => ({
         id: item.id,
         success: false,
         error: `Failed to execute reader operation batch: ${error.message || 'Unknown error'}`,
         suggestion: 'Check tool configuration and input arguments.'
       }));
    }
  }
};

// Export the tool
export default readerTool; // Or export { readerTool };

console.log('MCP Reader Tool Package Loaded');

// Re-export core types if needed by consumers of this package directly
export type { ReaderInputItem, ReaderResultItem, ReadOperation };
