// src/index.ts for @sylphlab/mcp-base64-core

// Export encode tool components
export { encodeBase64Tool, EncodeBase64ToolInputSchema } from './tools/encodeBase64Tool.js';
export type { EncodeBase64ToolInput, EncodeBase64ToolOutput } from './tools/encodeBase64Tool.js';

// Export decode tool components
export { decodeBase64Tool, DecodeBase64ToolInputSchema } from './tools/decodeBase64Tool.js';
export type { DecodeBase64ToolInput, DecodeBase64ToolOutput } from './tools/decodeBase64Tool.js';

console.log('MCP Base64 Core Package (Tool Structure) Loaded');
