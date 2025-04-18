export { processHashOperationsTool, type HasherInputItem, type HasherResultItem, type HashAlgorithm } from '@sylphlab/mcp-hasher-core';

console.log('MCP Hasher Package Loaded (re-exporting core)');

// Re-export the core function and types
export { processHashOperations };
export type { HasherInputItem, HasherResultItem, HashAlgorithm };
