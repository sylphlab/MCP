// src/index.ts for @sylphlab/mcp-net-core

// --- Get Public IP Tool ---
export { getPublicIpTool } from './tools/getPublicIpTool.js';
export { GetPublicIpToolInputSchema } from './tools/getPublicIpTool.schema.js'; // Export schema from schema file
export type { GetPublicIpToolInput, GetPublicIpResult } from './tools/getPublicIpTool.js';

// --- Get Interfaces Tool ---
export { getInterfacesTool } from './tools/getInterfacesTool.js';
export { GetInterfacesToolInputSchema } from './tools/getInterfacesTool.schema.js'; // Export schema from schema file
export type {
  GetInterfacesToolInput,
  GetInterfacesResult,
  NetworkInterfaces,
} from './tools/getInterfacesTool.js';

// --- Download Tool ---
export { downloadTool } from './tools/downloadTool.js';
export { downloadToolInputSchema } from './tools/downloadTool.schema.js';
export type { DownloadResultItem } from './tools/downloadTool.types.js'; // Correct path for output interface

// --- Fetch Tool ---
export { fetchTool } from './tools/fetchTool.js';
export type {
  FetchToolInput,
  FetchResultItem,
  FetchInputItem,
} from './tools/fetchTool.js';
