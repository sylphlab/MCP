// src/index.ts for @sylphlab/mcp-fetch-core

// Export the tool implementation, Zod schema, and inferred types
export { fetchTool, FetchToolInputSchema } from './tools/fetchTool.js';
export type {
  FetchToolInput,
  FetchToolOutput,
} from './tools/fetchTool.js';

console.log('MCP Fetch Core Package (Single Operation Tool Structure) Loaded');
