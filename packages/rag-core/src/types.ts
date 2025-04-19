/**
 * Represents a chunk of text, potentially with associated metadata.
 */
export interface Chunk {
  /** The actual text content of the chunk. */
  content: string;
  /** Optional metadata associated with the chunk. */
  metadata?: {
    /** The source identifier (e.g., file path, URL). */
    source?: string;
    /** Starting line number in the original source (1-based). */
    startLine?: number;
    /** Ending line number in the original source (1-based). */
    endLine?: number;
    /** The type of the primary AST node this chunk represents (if applicable). */
    nodeType?: string;
    /** Language of the chunk (especially relevant for code blocks within Markdown). */
    language?: string;
    // Add other relevant metadata as needed
    [key: string]: unknown; // Allow arbitrary metadata
  };
}