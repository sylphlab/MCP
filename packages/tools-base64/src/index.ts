// src/index.ts for @sylphlab/mcp-base64-core

// Export encode tool components
export { encodeBase64Tool } from './tools/encodeBase64Tool.js';
export { EncodeBase64ToolInputSchema } from './tools/encodeBase64Tool.schema.js'; // Export schema from schema file
export type { EncodeBase64ToolInput, EncodeBase64Result } from './tools/encodeBase64Tool.js';

// Export decode tool components
export { decodeBase64Tool } from './tools/decodeBase64Tool.js';
export { DecodeBase64ToolInputSchema } from './tools/decodeBase64Tool.schema.js'; // Export schema from schema file
export type { DecodeBase64ToolInput, DecodeBase64Result } from './tools/decodeBase64Tool.js';
