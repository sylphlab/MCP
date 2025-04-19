/**
 * Represents a loaded document before chunking.
 */
export interface Document {
  /** Unique identifier for the document (e.g., relative file path). */
  id: string;
  /** The full text content of the document. */
  content: string;
  /** Optional metadata associated with the document. */
  metadata?: Record<string, any>;
}

/**
 * Represents a chunk of a document after processing.
 * Extends Document, inheriting id, content, and metadata.
 */
export interface Chunk extends Document {
  /** Optional: Original start position within the parent document. */
  startPosition?: number;
  /** Optional: Original end position within the parent document. */
  endPosition?: number;
  // Metadata will be augmented during chunking (e.g., nodeType, codeLanguage)
}