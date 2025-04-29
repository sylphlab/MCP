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

import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema
import type { ToolExecuteOptions } from '@sylphlab/tools-core';
import { z } from 'zod'; // Import z
// Import schemas needed for RagConfigSchema
import { EmbeddingModelConfigSchema, type EmbeddingModelConfig } from './embedding.js'; // Import type as well
import { VectorDbConfigSchema, IndexManager, type VectorDbConfig } from './indexManager.js'; // Import type as well
import type { ChunkingOptions } from './chunking.js';

/**
 * Configuration for the core RAG operations (DB and Embedding).
 * This is passed to core tools via RagCoreToolExecuteOptions.
 */
export interface RagConfig {
  vectorDb: VectorDbConfig; // Type is now imported
  embedding: EmbeddingModelConfig; // Type is now imported
}

/**
 * Zod schema corresponding to RagConfig.
 */
export const RagConfigSchema = z.object({
  vectorDb: VectorDbConfigSchema,
  embedding: EmbeddingModelConfigSchema,
});

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
  indexManager: IndexManager; // IndexManager is a class instance, tricky to represent in Zod directly
  ragConfig: RagConfig; // Keep ragConfig for embedding details etc.
}

/**
 * Zod schema corresponding to RagToolExecuteOptions.
 * Note: Representing class instances like IndexManager in Zod is complex.
 * We use z.any() and rely on runtime checks or type assertions for now.
 * A more robust solution might involve dependency injection or a service locator pattern.
 */
export const RagContextSchema = BaseContextSchema.extend({
  indexManager: z.any().refine(val => val instanceof IndexManager, {
    message: "indexManager must be an instance of IndexManager"
  }), // Use z.any() for class instance, add refinement
  ragConfig: RagConfigSchema,
});
export type RagContext = z.infer<typeof RagContextSchema>;
