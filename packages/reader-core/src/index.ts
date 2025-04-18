// src/index.ts for @sylphlab/mcp-reader-core

// Export the tool implementation, Zod schema, and inferred types
export { readerTool, ReaderToolInputSchema } from './tools/readerTool.js';
export type {
  ReaderToolInput,
  ReaderInputItem,
  ReaderToolOutput,
  ReaderResultItem,
  ReadOperation,
} from './tools/readerTool.js';

console.log('MCP Reader Core Package (Tool Structure) Loaded');
