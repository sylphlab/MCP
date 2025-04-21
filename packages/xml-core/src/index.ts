// src/index.ts for @sylphlab/mcp-xml-core

// Export the tool implementation, Zod schema, and inferred types
export { xmlTool } from './tools/xmlTool.js';
export { xmlToolInputSchema, XmlOperationEnum } from './tools/xmlTool.schema.js'; // Export schema from schema file
export type {
  XmlToolInput,
  XmlToolOutput,
  XmlOperation, // Still useful to export the operation type
} from './tools/xmlTool.js';
