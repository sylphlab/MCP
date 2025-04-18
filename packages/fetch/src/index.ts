import { processFetchRequests, type FetchInputItem, type FetchResultItem } from '@sylphlab/mcp-fetch-core';

console.log('MCP Fetch Package Loaded (re-exporting core)');

// Re-export the core function and types
export { processFetchRequests };
export type { FetchInputItem, FetchResultItem };
