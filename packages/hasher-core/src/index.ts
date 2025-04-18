// src/index.ts for @sylphlab/mcp-hasher-core

// Export the tool implementation, Zod schema, and inferred types
export { hashTool, HashToolInputSchema } from './tools/hashTool.js';
export type {
  HashToolInput,
  HasherInputItem,
  HashToolOutput,
  HasherResultItem,
  HashAlgorithm,
} from './tools/hashTool.js';

console.log('MCP Hasher Core Package (Tool Structure) Loaded');
