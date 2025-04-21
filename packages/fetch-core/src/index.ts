// src/index.ts for @sylphlab/mcp-fetch-core

// Export the tool implementation, Zod schema, and inferred types
export { fetchTool } from './tools/fetchTool.js';
export { fetchToolInputSchema } from './tools/fetchTool.schema.js'; // Export schema from schema file
export type {
  FetchToolInput,
  FetchToolOutput,
} from './tools/fetchTool.js';

console.log('MCP Fetch Core Package (Single Operation Tool Structure) Loaded');
