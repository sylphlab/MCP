// src/index.ts for @sylphlab/mcp-json-core

// Export the tool implementation, Zod schema, and inferred types
export { jsonTool, JsonToolInputSchema, JsonOperationEnum } from './tools/jsonTool.js';
export type {
  JsonToolInput,
  JsonToolOutput,
  JsonOperation, // Still useful to export the operation type
} from './tools/jsonTool.js';

console.log('MCP JSON Core Package (Single Operation Tool Structure) Loaded');
