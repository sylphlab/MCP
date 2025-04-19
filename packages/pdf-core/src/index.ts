// src/index.ts for @sylphlab/mcp-pdf-core

// Export the tool implementation, Zod schema, core function, and inferred types
export { getTextTool, GetTextToolInputSchema, extractPdfText } from './tools/getTextTool.js';
export type { GetTextToolInput, GetTextToolOutput } from './tools/getTextTool.js';

// Add exports for future PDF tools here (e.g., getImageTool)

console.log('MCP PDF Core Package (getTextTool) Loaded');
