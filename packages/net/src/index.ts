import { processNetOperations, type NetInputItem, type NetResultItem, type NetOperation } from '@sylphlab/mcp-net-core';

console.log('MCP Net Package Loaded (re-exporting core)');

// Re-export the core function and types
export { processNetOperations };
export type { NetInputItem, NetResultItem, NetOperation };
