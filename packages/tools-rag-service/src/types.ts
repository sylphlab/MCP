import type { RagConfig, ChunkingOptions } from '@sylphlab/tools-rag';

/**
 * Configuration specific to the optional RAG background service.
 */
export interface RagServiceConfig extends RagConfig {
  /** Enable automatic scanning and watching of the workspace. */
  autoWatchEnabled: boolean;
  /** Whether to respect .gitignore rules during scanning/watching. */
  respectGitignore: boolean;
  /** Delay in milliseconds to wait after a file change before re-indexing. */
  debounceDelay: number;
  /** Glob patterns to explicitly include during scanning/watching. */
  includePatterns?: string[];
  /** Glob patterns to explicitly exclude during scanning/watching (in addition to .gitignore). */
  excludePatterns?: string[];
  /** Options for chunking code. */
  chunkingOptions?: ChunkingOptions;
  // Add other service-specific settings as needed
}