// src/index.ts for @sylphlab/mcp-json-core

// Export the tool implementation, Zod schema, and inferred types
export { jsonTool, JsonToolInputSchema } from './tools/jsonTool.js';
export type {
  JsonToolInput,
  JsonInputItem,
  JsonToolOutput,
  JsonResultItem,
  JsonOperation,
} from './tools/jsonTool.js';

console.log('MCP JSON Core Package (Tool Structure) Loaded');
