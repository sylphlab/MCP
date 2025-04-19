// src/index.ts for @sylphlab/mcp-net-core

// Export the tool implementation, Zod schema, and inferred types
export { netTool, NetToolInputSchema, NetOperationEnum } from './tools/netTool.js';
export type {
  NetToolInput,
  NetToolOutput,
  NetOperation, // Still useful to export the operation type
} from './tools/netTool.js';

console.log('MCP Net Core Package (Single Operation Tool Structure) Loaded');
