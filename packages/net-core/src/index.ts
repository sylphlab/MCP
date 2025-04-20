// src/index.ts for @sylphlab/mcp-net-core

// --- Get Public IP Tool ---
export { getPublicIpTool, GetPublicIpToolInputSchema } from './tools/getPublicIpTool';
export type { GetPublicIpToolInput, GetPublicIpToolOutput } from './tools/getPublicIpTool';

// --- Get Interfaces Tool ---
export { getInterfacesTool, GetInterfacesToolInputSchema } from './tools/getInterfacesTool';
export type { GetInterfacesToolInput, GetInterfacesToolOutput } from './tools/getInterfacesTool';

// --- Download Tool ---
export { downloadTool } from './tools/downloadTool';
export { downloadToolInputSchema } from './tools/downloadTool.schema';
export type { DownloadToolInput } from './tools/downloadTool.types'; // Correct path for input type
export type { DownloadToolOutput } from './tools/downloadTool.types'; // Correct path for output interface

console.log('MCP Net Core Package (getPublicIp, getInterfaces, download Tools) Loaded');
