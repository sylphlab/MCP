// src/index.ts for @sylphlab/mcp-xml-core

// Export the tool implementation, Zod schema, and inferred types
export { xmlTool, XmlToolInputSchema } from './tools/xmlTool.js';
export type {
  XmlToolInput,
  XmlInputItem,
  XmlToolOutput,
  XmlResultItem,
  XmlOperation,
} from './tools/xmlTool.js';

console.log('MCP XML Core Package (Tool Structure) Loaded');
