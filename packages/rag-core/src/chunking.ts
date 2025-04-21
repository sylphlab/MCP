import { Tree, type SyntaxNode } from '@lezer/common'; // Import Lezer types
import type { Document, Chunk } from './types.js';
import { parseCode, SupportedLanguage } from './parsing.js';
import path from 'node:path';

// --- Constants ---
const DEFAULT_MAX_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 100;

// --- Types ---
export interface ChunkingOptions {
  maxChunkSize?: number;
  chunkOverlap?: number;
}

// Node types that represent good chunk boundaries per language (using Lezer names)
const CHUNK_BOUNDARY_TYPES: Partial<Record<SupportedLanguage, string[]>> = {
  [SupportedLanguage.JavaScript]: ['FunctionDeclaration', 'ClassDeclaration', 'VariableDefinition', 'MethodDefinition', 'ExportDeclaration', 'Comment', 'BlockComment', 'LineComment'],
  [SupportedLanguage.TypeScript]: ['FunctionDeclaration', 'ClassDeclaration', 'VariableDefinition', 'MethodDefinition', 'ExportDeclaration', 'InterfaceDeclaration', 'TypeAliasDeclaration', 'Comment', 'BlockComment', 'LineComment'],
  [SupportedLanguage.TSX]: ['FunctionDeclaration', 'ClassDeclaration', 'VariableDefinition', 'MethodDefinition', 'ExportDeclaration', 'InterfaceDeclaration', 'TypeAliasDeclaration', 'JSXElement', 'JSXSelfClosingElement', 'Comment', 'BlockComment', 'LineComment'],
  [SupportedLanguage.Python]: ['FunctionDefinition', 'ClassDefinition', 'Comment', 'BlockComment'],
  [SupportedLanguage.Markdown]: ['ATXHeading1', 'ATXHeading2', 'SetextHeading1', 'SetextHeading2', 'FencedCode', 'Blockquote', 'ListItem', 'Paragraph'],
  [SupportedLanguage.JSON]: ['Object', 'Array'],
  [SupportedLanguage.CSS]: ['RuleSet', 'AtRule', 'Comment', 'BlockComment'],
  [SupportedLanguage.HTML]: ['Element', 'ScriptElement', 'StyleElement', 'Comment'],
  [SupportedLanguage.XML]: ['Element', 'Comment'],
};

// --- Helper Functions ---

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
        if (start >= text.length) break;
    }
    return chunks;
}

function createChunk(
    document: Document, content: string, startIndex: number, endIndex: number,
    chunkIndex: number, metadata: Record<string, any> = {}
): Chunk {
    const { metadata: docMetadata, ...docBase } = document;
    return {
        ...docBase, id: `${document.id}::chunk_${chunkIndex}`, content: content,
        startPosition: startIndex, endPosition: endIndex,
        metadata: { ...docMetadata, chunkIndex: chunkIndex, originalId: document.id, ...metadata }
    };
}

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
 * Simplified chunking logic V9: Only chunk direct children of top node if boundary & fits.
 */
function simpleLezerChunker(
    node: SyntaxNode,
    document: Document,
    options: Required<Omit<ChunkingOptions, 'metadata'>>,
    language: SupportedLanguage,
    chunkCounter: { index: number }
): Chunk[] {
    const chunks: Chunk[] = [];
    const boundaryTypes = CHUNK_BOUNDARY_TYPES[language] || [];

    let child = node.firstChild;
    console.log(`[simpleLezerChunker] Processing node ${node.type.name} (${node.from}-${node.to})`);
    while (child) {
        console.log(`[simpleLezerChunker]  - Child: ${child.type.name} (${child.from}-${child.to})`);
        const childText = document.content.substring(child.from, child.to);
        const isBoundary = boundaryTypes.includes(child.type.name);
        const fits = childText.length <= options.maxChunkSize;
        console.log(`[simpleLezerChunker]    - Boundary: ${isBoundary}, Fits: ${fits}`);

        if (isBoundary && fits) {
            console.log(`[simpleLezerChunker]    - Creating chunk for ${child.type.name}`);
            chunks.push(createChunk(
                document, childText, child.from, child.to, chunkCounter.index++,
                { nodeType: child.type.name, language: language }
            ));
        } else {
             console.log(`[simpleLezerChunker]    - Ignoring child ${child.type.name}`);
        }
        // Ignore text between nodes and non-boundary/non-fitting children

        child = child.nextSibling;
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
    baseMetadata: Record<string, any> = {}
): Chunk[] {
    const mergedOptions: Required<Omit<ChunkingOptions, 'metadata'>> = {
        maxChunkSize: options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE,
        chunkOverlap: options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
    };
    const document: Document = {
        id: baseMetadata?.filePath || baseMetadata?.source || 'code_snippet',
        content: code,
        metadata: { language, ...baseMetadata }
    };
    const chunkCounter = { index: 0 };

    if (language === SupportedLanguage.Markdown) {
        console.warn('Markdown AST chunking deferred. Applying fallback text splitting.');
        const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
        return textChunks.map((textChunk: string, idx: number) => createChunk(document, textChunk, -1, -1, chunkCounter.index++, { language: language, warning: `Fallback text splitting applied (Markdown AST deferred)` }));
    }

    if (!language) {
        console.warn('Language not provided or detected, applying fallback text splitting.');
        const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
        return textChunks.map((textChunk: string, idx: number) => createChunk(document, textChunk, -1, -1, chunkCounter.index++, { language: null, warning: 'Fallback text splitting applied (no language)' }));
    }

    try {
        const tree = parseCode(code, language);
        if (!tree || !tree.topNode) throw new Error('Parsing returned null or empty tree');

        // Use the simplified chunking function
        const chunks = simpleLezerChunker(tree.topNode, document, mergedOptions, language, chunkCounter);

        // If AST chunking yields no chunks (e.g., no top-level boundary nodes found), fallback to text split.
        if (chunks.length === 0 && code.length > 0) {
             console.warn(`Simplified AST chunking for ${language} yielded no chunks, applying fallback text splitting.`);
             const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
             return textChunks.map((textChunk: string, idx: number) => createChunk(document, textChunk, -1, -1, chunkCounter.index++, { language: language, warning: 'Fallback text splitting applied (no AST chunks)' }));
        }
        return chunks;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Lezer AST parsing/chunking failed for language ${language}. Applying fallback text splitting.`, error, { codeSnippet: code.substring(0, 100) });
        const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
        const fallbackChunks = textChunks.map((textChunk: string, idx: number) => createChunk(
            document,
            textChunk,
            -1, -1,
            chunkCounter.index++,
            {
                language: language,
                warning: `Fallback text splitting applied (parsing/chunking error: ${errorMessage})`,
                fallbackIndex: idx + 1,
                fallbackTotal: textChunks.length
            }
        ));
        return fallbackChunks;
    }
}
