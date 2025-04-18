// src/index.ts for @sylphlab/mcp-wait-core

// Export the tool implementation, Zod schema, and inferred type
export { waitTool, WaitToolInputSchema } from './tools/waitTool.js';
export type { WaitToolInput, WaitToolOutput } from './tools/waitTool.js'; // Also export output type if needed

console.log('MCP Wait Core Package (Tool Structure) Loaded');
