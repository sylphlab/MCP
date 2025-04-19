// src/index.ts for @sylphlab/mcp-reader-core

// Export the tool implementation, Zod schema, and inferred types
export { readerTool, ReaderToolInputSchema, ReadOperationEnum } from './tools/readerTool.js';
export type {
  ReaderToolInput,
  ReaderToolOutput,
  ReadOperation, // Still useful to export the operation type
} from './tools/readerTool.js';

console.log('MCP Reader Core Package (Single Operation Tool Structure) Loaded');
