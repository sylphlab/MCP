// src/index.ts for @sylphlab/mcp-xml-core

// Export the tool implementation, Zod schema, and inferred types
export { xmlTool, XmlToolInputSchema, XmlOperationEnum } from './tools/xmlTool.js';
export type {
  XmlToolInput,
  XmlToolOutput,
  XmlOperation, // Still useful to export the operation type
} from './tools/xmlTool.js';

console.log('MCP XML Core Package (Single Operation Tool Structure) Loaded');
