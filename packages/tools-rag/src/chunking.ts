import path from 'node:path';
import { type SyntaxNode } from '@lezer/common'; // Import Lezer types
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
 * Recursive Lezer AST chunking logic.
 * Attempts to chunk based on boundary types. If a boundary node is too large,
 * it RECURSES into the oversized node to find smaller boundaries within.
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
      // Boundary node fits, create a chunk
      chunks.push(
        createChunk(document, childText, child.from, child.to, chunkCounter.index++, {
          nodeType: child.type.name,
          language: language,
        }),
      );
    } else if (isBoundary && !fits) {
      // Boundary node is too large, RECURSE into it
      console.warn(`Node type ${child.type.name} at ${child.from}-${child.to} exceeds maxChunkSize. Recursing into node.`);
      chunks.push(...recursiveLezerChunker(child, document, options, language, chunkCounter));
    } else if (!isBoundary && child.firstChild) {
      // Not a boundary, but has children, recurse into it
      chunks.push(...recursiveLezerChunker(child, document, options, language, chunkCounter));
    } else {
       // Leaf node or unhandled case. Ignore small text nodes between boundaries.
    }

    currentChild = child.nextSibling;
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

  if (language === SupportedLanguage.Markdown || !language) {
    const warningMsg = language === SupportedLanguage.Markdown
        ? 'Fallback text splitting applied (Markdown AST deferred)'
        : 'Fallback text splitting applied (no language)';
    const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
    return textChunks.map((textChunk: string, _idx: number) =>
      createChunk(document, textChunk, -1, -1, chunkCounter.index++, { language: language, warning: warningMsg })
    );
  }

  try {
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
