// src/index.ts for @sylphlab/mcp-net-core

// Export the tool implementation, Zod schema, and inferred types
export { netTool, NetToolInputSchema } from './tools/netTool.js';
export type {
  NetToolInput,
  NetInputItem,
  NetToolOutput,
  NetResultItem,
  NetOperation,
} from './tools/netTool.js';

console.log('MCP Net Core Package (Tool Structure) Loaded');
