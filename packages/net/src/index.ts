import { processNetOperations, type NetInputItem, type NetResultItem, type NetOperation } from 'net-core-mcp';

console.log('MCP Net Package Loaded (re-exporting core)');

// Re-export the core function and types
export { processNetOperations };
export type { NetInputItem, NetResultItem, NetOperation };
