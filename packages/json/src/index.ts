import { processJsonOperations, type JsonInputItem, type JsonResultItem, type JsonOperation } from 'json-core-mcp';

console.log('MCP JSON Package Loaded (re-exporting core)');

// Re-export the core function and types
export { processJsonOperations };
export type { JsonInputItem, JsonResultItem, JsonOperation };
