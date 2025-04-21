// src/index.ts for @sylphlab/mcp-wait-core

// Export the tool implementation, Zod schema, and inferred type
export { waitTool } from './tools/waitTool.js';
export { waitToolInputSchema } from './tools/waitTool.schema.js'; // Export schema from schema file
export type { WaitToolInput, WaitToolOutput } from './tools/waitTool.js'; // Also export output type if needed

console.log('MCP Wait Core Package (Tool Structure) Loaded');
