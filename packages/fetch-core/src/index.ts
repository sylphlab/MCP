// src/index.ts for @sylphlab/mcp-fetch-core

// Export the tool implementation, Zod schema, and inferred types
export { fetchTool, FetchToolInputSchema } from './tools/fetchTool.js';
export type {
  FetchToolInput,
  FetchToolOutput,
  // Keep FetchResultItem if it's conceptually useful, though FetchToolOutput covers the single result
  // FetchResultItem
} from './tools/fetchTool.js';

console.log('MCP Fetch Core Package (Single Operation Tool Structure) Loaded');
