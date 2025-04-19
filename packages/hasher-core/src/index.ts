// src/index.ts for @sylphlab/mcp-hasher-core

// Export the tool implementation, Zod schema, and inferred types
export { hashTool, HashToolInputSchema } from './tools/hashTool.js';
export type {
  HashToolInput,
  HashToolOutput,
  HashAlgorithm, // Still useful to export the algorithm type
} from './tools/hashTool.js';

console.log('MCP Hasher Core Package (Single Operation Tool Structure) Loaded');
