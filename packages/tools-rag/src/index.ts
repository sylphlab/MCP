// Main export for @sylphlab/mcp-rag-core

// Types
// Export RagConfig and the correct RagToolExecuteOptions
export type { Document, Chunk, RagConfig, RagToolExecuteOptions } from './types.js';
export type { ChunkingOptions } from './chunking.js';
export type { EmbeddingModelConfig, EmbeddingVector, IEmbeddingFunction } from './embedding.js'; // Ensure IEmbeddingFunction is exported
export {
  EmbeddingModelProvider,
  EmbeddingModelConfigSchema,
  defaultEmbeddingConfig,
  OllamaEmbeddingFunction,
  MockEmbeddingFunction,
  HttpEmbeddingFunction, // Add HttpEmbeddingFunction export
} from './embedding.js'; // Ensure classes are exported
export type { IndexedItem, VectorDbConfig, QueryResult } from './indexManager.js';
export { VectorDbConfigSchema, IndexManager, VectorDbProvider } from './indexManager.js';

// Functions
export { chunkCodeAst, detectLanguage } from './chunking.js'; // Ensure detectLanguage is exported
export { generateEmbeddings } from './embedding.js';
export { parseCode, SupportedLanguage } from './parsing.js';
export { loadDocuments } from './loader.js'; // Restored
export { getRagCollection, convertFilterToChromaWhere } from './chroma.js';

// Tools
export { indexContentTool } from './tools/indexContentTool.js';
export { queryIndexTool } from './tools/queryIndexTool.js';
export { indexStatusTool } from './tools/indexStatusTool.js';
export { getChunksForFileTool } from './tools/getChunksForFileTool.js';
export { manualIndexFileTool } from './tools/manualIndexFileTool.js'; // Added export

