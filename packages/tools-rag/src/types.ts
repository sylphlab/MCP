/**
 * Represents a loaded document before chunking.
 */
export interface Document {
  /** Unique identifier for the document (e.g., relative file path). */
  id: string;
  /** The full text content of the document. */
  content: string;
  /** Optional metadata associated with the document. */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a chunk of a document after processing.
 * Extends Document, inheriting id, content, and metadata.
 */
export interface Chunk extends Document {
  // Already exported, no change needed here. Diff is incorrect.
  /** Optional: Original start position within the parent document. */
  startPosition?: number;
  /** Optional: Original end position within the parent document. */
  endPosition?: number;
  // Metadata will be augmented during chunking (e.g., nodeType, codeLanguage)
}

import type { ToolExecuteOptions } from '@sylphlab/tools-core';
import type { EmbeddingModelConfig } from './embedding.js';
import type { VectorDbConfig, IndexManager } from './indexManager.js'; // Import IndexManager
import type { ChunkingOptions } from './chunking.js';

/**
 * Configuration for the core RAG operations (DB and Embedding).
 * This is passed to core tools via RagCoreToolExecuteOptions.
 */
export interface RagConfig {
  vectorDb: VectorDbConfig;
  embedding: EmbeddingModelConfig;
}

/**
 * Extended ToolExecuteOptions specifically for core RAG tools.
 * It includes the essential configuration needed for their execution.
 */
// export interface RagCoreToolExecuteOptions extends ToolExecuteOptions {
//   ragConfig: RagConfig;
// }

/**
 * Extended ToolExecuteOptions for RAG tools, providing access to the
 * initialized IndexManager instance and the core RAG configuration.
 */
export interface RagToolExecuteOptions extends ToolExecuteOptions {
  indexManager: IndexManager;
  ragConfig: RagConfig; // Keep ragConfig for embedding details etc.
}
