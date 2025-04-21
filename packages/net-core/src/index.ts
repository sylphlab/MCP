// src/index.ts for @sylphlab/mcp-net-core

// --- Get Public IP Tool ---
export { getPublicIpTool } from './tools/getPublicIpTool.js';
export { GetPublicIpToolInputSchema } from './tools/getPublicIpTool.schema.js'; // Export schema from schema file
export type { GetPublicIpToolInput, GetPublicIpToolOutput } from './tools/getPublicIpTool.js';

// --- Get Interfaces Tool ---
export { getInterfacesTool } from './tools/getInterfacesTool.js';
export { GetInterfacesToolInputSchema } from './tools/getInterfacesTool.schema.js'; // Export schema from schema file
export type { GetInterfacesToolInput, GetInterfacesToolOutput } from './tools/getInterfacesTool.js';

// --- Download Tool ---
export { downloadTool } from './tools/downloadTool.js';
export { downloadToolInputSchema } from './tools/downloadTool.schema.js';
export type { DownloadToolInput } from './tools/downloadTool.types.js'; // Correct path for input type
export type { DownloadToolOutput } from './tools/downloadTool.types.js'; // Correct path for output interface

console.log('MCP Net Core Package (getPublicIp, getInterfaces, download Tools) Loaded');
