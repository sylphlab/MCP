// src/index.ts for @sylphlab/mcp-hasher-core

// Export the tool implementation, Zod schema, and inferred types
export { hashTool } from './tools/hashTool.js';
export { hashToolInputSchema } from './tools/hashTool.schema.js'; // Export schema from schema file
export type {
  HashToolInput,
  HashToolOutput,
  HashAlgorithm, // Still useful to export the algorithm type
} from './tools/hashTool.js';
