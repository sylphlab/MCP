// Main export for @sylphlab/mcp-rag-core

// Types
export type { Document, Chunk } from './types.js';
export type { ChunkingOptions } from './chunking.js';
export type { EmbeddingModelConfig, EmbeddingVector, IEmbeddingFunction } from './embedding.js'; // Ensure IEmbeddingFunction is exported
export {
  EmbeddingModelProvider,
  EmbeddingModelConfigSchema,
  defaultEmbeddingConfig,
  OllamaEmbeddingFunction,
  MockEmbeddingFunction,
} from './embedding.js'; // Ensure classes are exported
export type { IndexedItem, VectorDbConfig, QueryResult } from './indexManager.js';
export { VectorDbConfigSchema, IndexManager, VectorDbProvider } from './indexManager.js';

// Functions
export { chunkCodeAst, detectLanguage } from './chunking.js'; // Ensure detectLanguage is exported
export { generateEmbeddings } from './embedding.js';
export { parseCode, SupportedLanguage } from './parsing.js';
export { loadDocuments } from './loader.js';
export { getRagCollection, convertFilterToChromaWhere } from './chroma.js';

// Tools
export { indexContentTool } from './tools/indexContentTool.js';
export { queryIndexTool } from './tools/queryIndexTool.js';
export { indexStatusTool } from './tools/indexStatusTool.js';
