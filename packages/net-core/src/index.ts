// src/index.ts for @sylphlab/mcp-net-core

// --- Fetch Tool ---
export { fetchTool, FetchToolInputSchema } from './tools/fetchTool.js';
export type { FetchToolInput, FetchToolOutput } from './tools/fetchTool.js';

// --- Get Public IP Tool ---
export { getPublicIpTool, GetPublicIpToolInputSchema } from './tools/getPublicIpTool.js';
export type { GetPublicIpToolInput, GetPublicIpToolOutput } from './tools/getPublicIpTool.js';

// --- Get Interfaces Tool ---
export { getInterfacesTool, GetInterfacesToolInputSchema } from './tools/getInterfacesTool.js';
export type { GetInterfacesToolInput, GetInterfacesToolOutput } from './tools/getInterfacesTool.js';

console.log('MCP Net Core Package (fetch, getPublicIp, getInterfaces Tools) Loaded');
