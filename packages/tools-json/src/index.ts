// src/index.ts for @sylphlab/mcp-json-core

// Export the tool implementation, Zod schema, and inferred types
export { jsonTool } from './tools/jsonTool.js';
export { jsonToolInputSchema, JsonOperationEnum } from './tools/jsonTool.schema.js'; // Export schema from schema file
export type {
  JsonToolInput,
  JsonResultItem,
  JsonInputItem,
  JsonOperation, // Still useful to export the operation type
} from './tools/jsonTool.js';
