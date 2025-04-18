import { processFetchRequests, type FetchInputItem, type FetchResultItem } from 'fetch-core-mcp';

console.log('MCP Fetch Package Loaded (re-exporting core)');

// Re-export the core function and types
export { processFetchRequests };
export type { FetchInputItem, FetchResultItem };
