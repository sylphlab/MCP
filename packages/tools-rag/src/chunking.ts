import path from 'node:path';
import type { SyntaxNode } from '@lezer/common'; // Import Lezer types
import { SupportedLanguage, parseCode } from './parsing.js';
import type { Chunk, Document } from './types.js';

// --- Constants ---
const DEFAULT_MAX_CHUNK_SIZE = 16000; // Keep increased size
const DEFAULT_CHUNK_OVERLAP = 200;  // Keep increased overlap

// --- Types ---
export interface ChunkingOptions {
  maxChunkSize?: number;
  chunkOverlap?: number;
}

// Node types that represent good chunk boundaries per language (using Lezer names)
const CHUNK_BOUNDARY_TYPES: Partial<Record<SupportedLanguage, string[]>> = {
  [SupportedLanguage.JavaScript]: [
    'FunctionDeclaration', 'ClassDeclaration', 'VariableDefinition',
    'MethodDefinition', 'ExportDeclaration', 'Comment', 'BlockComment', 'LineComment',
  ],
  [SupportedLanguage.TypeScript]: [
    'FunctionDeclaration', 'ClassDeclaration', 'VariableDefinition',
    'MethodDefinition', 'ExportDeclaration', 'InterfaceDeclaration',
    'TypeAliasDeclaration', 'Comment', 'BlockComment', 'LineComment',
  ],
  [SupportedLanguage.TSX]: [
    'FunctionDeclaration', 'ClassDeclaration', 'VariableDefinition',
    'MethodDefinition', 'ExportDeclaration', 'InterfaceDeclaration',
    'TypeAliasDeclaration', 'JSXElement', 'JSXSelfClosingElement',
    'Comment', 'BlockComment', 'LineComment',
  ],
  [SupportedLanguage.Python]: ['FunctionDefinition', 'ClassDefinition', 'Comment', 'BlockComment'],
  [SupportedLanguage.Markdown]: [
    'ATXHeading1', 'ATXHeading2', 'SetextHeading1', 'SetextHeading2',
    'FencedCode', 'Blockquote', 'ListItem', 'Paragraph',
  ],
  [SupportedLanguage.JSON]: ['Object', 'Array'],
  [SupportedLanguage.CSS]: ['RuleSet', 'AtRule', 'Comment', 'BlockComment'],
  [SupportedLanguage.HTML]: ['Element', 'ScriptElement', 'StyleElement', 'Comment'],
  [SupportedLanguage.XML]: ['Element', 'Comment'],
};

// --- Helper Functions ---

/** Splits text into chunks with overlap, ensuring no chunk exceeds maxSize. */
function splitTextWithOverlap(text: string, maxSize: number, overlap: number): string[] {
  if (text.length <= maxSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  const step = Math.max(1, maxSize - overlap);
  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    chunks.push(text.substring(start, end));
    if (end === text.length) break;
    start += step;
    if (start >= end) break;
  }
  return chunks;
}

/**
 * Attempts to split text using sentence-like boundaries or blank lines.
 * Used as a fallback when an AST node is too large but has no children.
 */
function applySmartFallbackSplitting(
    text: string,
    originalStartIndex: number, // Need this to calculate correct chunk start/end positions
    document: Document,
    options: Required<ChunkingOptions>,
    language: SupportedLanguage | null, // Pass language for context
    chunkCounter: { index: number }
): Chunk[] {
    const { maxChunkSize, chunkOverlap } = options;
    let splitChunks: string[] = [];
    let warning = 'Smart fallback applied';

    // 1. Try splitting by sentences/paragraphs (simple regex)
    // Match sentence endings followed by space or newline, or double newlines
    const sentenceRegex = /([.?!])(?:\s+|\n)|(\n\n)/g;
    let lastIndex = 0;
    const potentialSentenceChunks: string[] = [];
    let match: RegExpExecArray | null;
    // biome-ignore lint/correctness/noConstantCondition: Standard pattern for exec loop
    while (true) {
        match = sentenceRegex.exec(text);
        if (match === null) {
            break;
        }
        const endIndex = match.index + match[0].length;
        potentialSentenceChunks.push(text.substring(lastIndex, endIndex).trim());
        lastIndex = endIndex;
    }
    potentialSentenceChunks.push(text.substring(lastIndex).trim()); // Add the remainder

    if (potentialSentenceChunks.every(c => c.length <= maxChunkSize) && potentialSentenceChunks.length > 1) {
        splitChunks = potentialSentenceChunks.filter(c => c.length > 0);
        warning += ' (by sentence/paragraph)';
    } else {
        // 2. Try splitting by blank lines
        const blankLineChunks = text.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
        if (blankLineChunks.every(c => c.length <= maxChunkSize) && blankLineChunks.length > 1) {
            splitChunks = blankLineChunks;
            warning += ' (by blank line)';
        } else {
            // 3. Final resort: splitTextWithOverlap
            console.warn(`Smart fallback failed for text starting at ${originalStartIndex}, using basic overlap split.`);
            splitChunks = splitTextWithOverlap(text, maxChunkSize, chunkOverlap);
            warning += ' (by overlap)';
        }
    }

    // Create Chunk objects, adjusting start/end positions
    const finalChunks: Chunk[] = [];
    let currentOffset = 0;
    for (const splitText of splitChunks) {
        if (splitText.length === 0) continue;
        // Find the actual start index of this splitText within the original oversized text
        // This indexOf might be unreliable if the splitText appears multiple times.
        // A more robust approach might involve tracking offsets during splitting.
        const relativeStartIndex = text.indexOf(splitText, currentOffset);
        if (relativeStartIndex === -1) {
             console.error(`Could not find split chunk within original text during fallback. Original start: ${originalStartIndex}. Skipping chunk.`);
             // Fallback to less accurate positioning if needed, or skip
             continue;
        }
        const chunkStartIndex = originalStartIndex + relativeStartIndex;
        const chunkEndIndex = chunkStartIndex + splitText.length;
        finalChunks.push(
            createChunk(document, splitText, chunkStartIndex, chunkEndIndex, chunkCounter.index++, {
                language: language,
                warning: warning,
            })
        );
        currentOffset = relativeStartIndex + splitText.length; // Update offset for next search
    }
    return finalChunks;
}


/** Creates a Chunk object with consistent metadata. */
function createChunk(
  document: Document,
  content: string,
  startIndex: number,
  endIndex: number,
  chunkIndex: number,
  metadata: Record<string, unknown> = {},
): Chunk {
  const { metadata: docMetadata, ...docBase } = document;
  return {
    ...docBase,
    id: `${document.id}::chunk_${chunkIndex}`,
    content: content,
    startPosition: startIndex,
    endPosition: endIndex,
    metadata: {
        ...docMetadata,
        chunkIndex: chunkIndex,
        originalId: document.id,
        ...metadata,
    },
  };
}

/** Detects the language based on file extension. */
export function detectLanguage(filePath: string): SupportedLanguage | null {
  const extension = path.extname(filePath).toLowerCase().substring(1);
  switch (extension) {
    case 'js': case 'jsx': return SupportedLanguage.JavaScript;
    case 'ts': return SupportedLanguage.TypeScript;
    case 'tsx': return SupportedLanguage.TSX;
    case 'py': return SupportedLanguage.Python;
    case 'md': case 'markdown': return SupportedLanguage.Markdown;
    case 'json': return SupportedLanguage.JSON;
    case 'css': return SupportedLanguage.CSS;
    case 'html': case 'htm': return SupportedLanguage.HTML;
    case 'xml': return SupportedLanguage.XML;
    default: return null;
  }
}


/**
 * Enhanced recursive Lezer AST chunking logic.
 * Always traverses children. Prioritizes fitting boundary nodes.
 * Recurses into oversized nodes or applies smart fallback if no children.
 */
function recursiveLezerChunker(
  node: SyntaxNode,
  document: Document,
  options: Required<ChunkingOptions>,
  language: SupportedLanguage,
  chunkCounter: { index: number },
): Chunk[] {
  const chunks: Chunk[] = [];
  const boundaryTypes = CHUNK_BOUNDARY_TYPES[language] || [];

  let currentChild = node.firstChild;
  while (currentChild) {
    const child = currentChild; // Guaranteed non-null within the loop
    const childText = document.content.substring(child.from, child.to);
    const isBoundary = boundaryTypes.includes(child.type.name);
    const fits = childText.length <= options.maxChunkSize;

    // --- DEBUG LOGGING ---
    // Log details for all nodes being considered in the target file
    if (document.id.endsWith('ragIndexService.ts')) {
        console.log(`DEBUG[Chunker]: Node ${child.type.name} (${child.from}-${child.to}), Length: ${childText.length}, Fits (<=${options.maxChunkSize}): ${fits}, IsBoundary: ${isBoundary}, HasChildren: ${!!child.firstChild}`);
    }
    // --- END DEBUG ---

    if (isBoundary && fits) {
      // Boundary node fits -> Create chunk
      chunks.push(
        createChunk(document, childText, child.from, child.to, chunkCounter.index++, {
          nodeType: child.type.name,
          language: language,
        }),
      );
      // Don't recurse into fitting boundary nodes, treat them as units.
    } else if (!fits) {
      // Node is too large (boundary or not)
      if (child.firstChild) {
        // Too large, but has children -> Recurse
        console.warn(`Node ${child.type.name} (${child.from}-${child.to}) too large, recursing...`);
        chunks.push(...recursiveLezerChunker(child, document, options, language, chunkCounter));
      } else {
        // Too large, no children (e.g., large comment/text) -> Apply Smart Fallback
        console.warn(`Node ${child.type.name} (${child.from}-${child.to}) too large, no children, applying smart fallback...`);
        chunks.push(...applySmartFallbackSplitting(childText, child.from, document, options, language, chunkCounter));
      }
    } else { // Node fits, but is NOT a boundary
      if (child.firstChild) {
         // Fits, not boundary, but has children -> Recurse to find boundaries within
         chunks.push(...recursiveLezerChunker(child, document, options, language, chunkCounter));
      }
      // else: Fits, not boundary, no children (e.g., small identifier, operator) -> Ignore, let parent handle context
    }

    currentChild = child.nextSibling; // Move to the next sibling
  }
  return chunks;
}


/**
 * Chunks code based on its Lezer AST or falls back to text splitting.
 */
export function chunkCodeAst(
  code: string,
  language: SupportedLanguage | null,
  options?: ChunkingOptions,
  baseMetadata: Record<string, unknown> = {},
): Chunk[] {
  const mergedOptions: Required<ChunkingOptions> = {
    maxChunkSize: options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE,
    chunkOverlap: options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
  };
  const document: Document = {
    id: (baseMetadata?.filePath as string | undefined) || (baseMetadata?.source as string | undefined) || 'code_snippet',
    content: code,
    metadata: { language, ...baseMetadata },
  };
  const chunkCounter = { index: 0 };

  // Removed specific Markdown fallback - will now use Lezer parser for Markdown too.
  if (!language) {
      // Fallback for unknown language
      console.warn(`No language detected for document ${document.id}. Applying fallback text split.`);
      const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
      return textChunks.map((textChunk: string, _idx: number) =>
          createChunk(document, textChunk, -1, -1, chunkCounter.index++, { language: null, warning: 'Fallback text splitting applied (no language detected)' })
      );
  }

  try {
    // Parse using the appropriate Lezer parser (including Markdown)
    const tree = parseCode(code, language);
    if (!tree || !tree.topNode) throw new Error('Parsing returned null or empty tree');

    const chunks = recursiveLezerChunker(tree.topNode, document, mergedOptions, language, chunkCounter);

    // Fallback if AST chunking yields no results
    if (chunks.length === 0 && code.trim().length > 0) {
      console.warn(`AST chunking yielded no chunks for language ${language}. Applying fallback text split.`);
      const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
      return textChunks.map((textChunk: string, _idx: number) =>
        createChunk(document, textChunk, -1, -1, chunkCounter.index++, { language: language, warning: 'Fallback text splitting applied (no AST chunks)' })
      );
    }
    return chunks;
  } catch (error) {
    // Fallback on any parsing or chunking error
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Error during AST parsing/chunking for language ${language}: ${errorMessage}. Applying fallback text split.`);
    const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
    return textChunks.map((textChunk: string, idx: number) =>
      createChunk(document, textChunk, -1, -1, chunkCounter.index++, {
        language: language,
        warning: 'Fallback text splitting applied (parsing/chunking error)',
        error: errorMessage,
        fallbackIndex: idx + 1,
        fallbackTotal: textChunks.length,
      })
    );
  }
}
