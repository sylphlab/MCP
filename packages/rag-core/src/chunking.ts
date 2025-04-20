import Parser, { Tree, Language } from 'web-tree-sitter';
import { Document, Chunk } from './types.js';
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

// Node types that represent good chunk boundaries per language
const CHUNK_BOUNDARY_TYPES: Partial<Record<SupportedLanguage, string[]>> = {
  [SupportedLanguage.JavaScript]: ['function_declaration', 'class_declaration', 'method_definition', 'lexical_declaration', 'variable_declaration', 'export_statement', 'comment'],
  [SupportedLanguage.TypeScript]: ['function_declaration', 'class_declaration', 'method_definition', 'lexical_declaration', 'variable_declaration', 'export_statement', 'interface_declaration', 'type_alias_declaration', 'comment'],
  [SupportedLanguage.TSX]: ['function_declaration', 'class_declaration', 'method_definition', 'lexical_declaration', 'variable_declaration', 'export_statement', 'interface_declaration', 'type_alias_declaration', 'jsx_element', 'jsx_self_closing_element', 'comment'],
  [SupportedLanguage.Python]: ['function_definition', 'class_definition', 'comment'],
};

// --- Helper Functions ---

function splitTextWithOverlap(text: string, maxSize: number, overlap: number): string[] {
    console.log(`splitTextWithOverlap called: textLength=${text.length}, maxSize=${maxSize}, overlap=${overlap}`);
    if (text.length <= maxSize) {
        console.log('Text fits in one chunk.');
        return [text];
    }
    const chunks: string[] = [];
    let start = 0;
    const step = Math.max(1, maxSize - overlap);
    console.log(`Calculated step: ${step}`);

    while (start < text.length) {
        const end = Math.min(start + maxSize, text.length);
        console.log(`Loop: start=${start}, end=${end}`);
        chunks.push(text.substring(start, end));
        start += step;
        if (start >= text.length && end === text.length) {
             console.log('Breaking loop early.');
             break;
        }
    }

    // Duplicate check removed
    console.log(`splitTextWithOverlap returning ${chunks.length} chunks.`);
    return chunks;
}


function createChunk(
    document: Document,
    content: string,
    startIndex: number,
    endIndex: number,
    chunkIndex: number,
    metadata: Record<string, any> = {}
): Chunk {
    // Separate base document properties from its metadata
    const { metadata: docMetadata, ...docBase } = document;
    return {
        ...docBase, // Spread base properties (id, content)
        id: `${document.id}::chunk_${chunkIndex}`, // Generate unique chunk ID
        content: content, // Use new content
        startPosition: startIndex,
        endPosition: endIndex,
        metadata: { // Correctly merge metadata
            ...docMetadata, // Base metadata from document
            chunkIndex: chunkIndex,
            originalId: document.id,
            ...metadata, // Specific metadata for this chunk (like warning)
        }
    };
}

/** Export detectLanguage function */
export function detectLanguage(filePath: string): SupportedLanguage | null {
    const extension = path.extname(filePath).toLowerCase().substring(1);
    switch (extension) {
        case 'js':
        case 'jsx':
            return SupportedLanguage.JavaScript;
        case 'ts':
            return SupportedLanguage.TypeScript;
        case 'tsx':
             return SupportedLanguage.TSX;
        case 'py':
            return SupportedLanguage.Python;
        default:
            return null;
    }
}


/**
 * Recursive function to traverse the AST and create chunks.
 */
async function traverseAndChunk(
    node: any,
    document: Document,
    options: Required<Omit<ChunkingOptions, 'metadata'>>,
    language: SupportedLanguage,
    chunkCounter: { index: number }
): Promise<Chunk[]> {
    const chunks: Chunk[] = [];
    const nodeText = node.text;
    const boundaryTypes = CHUNK_BOUNDARY_TYPES[language] || [];
    const smallFragmentThreshold = Math.max(10, options.maxChunkSize * 0.1); // Define threshold for small fragments

    const isBoundary = boundaryTypes.includes(node.type);
    const fits = nodeText.length <= options.maxChunkSize;

    if (fits && isBoundary) {
        chunks.push(createChunk(
            document, nodeText, node.startIndex, node.endIndex, chunkCounter.index++,
            { nodeType: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, language: language }
        ));
        return chunks;
    }

    const meaningfulChildren = node.children?.filter((child: any) => boundaryTypes.includes(child.type)) || [];

    if (meaningfulChildren.length > 0) {
        let lastMeaningfulChildEnd = node.startIndex;
        let accumulatedPrefix = "";

        for (const meaningfulChild of meaningfulChildren) {
            const prefixText = document.content.substring(lastMeaningfulChildEnd, meaningfulChild.startIndex).trim();
            if (prefixText.length > 0) {
                 accumulatedPrefix += (accumulatedPrefix ? "\n\n" : "") + prefixText;
            }

            const childChunks = await traverseAndChunk(meaningfulChild, document, options, language, chunkCounter);
            console.log(`[After Recurse] childChunks for ${meaningfulChild.type} (${meaningfulChild.startIndex}-${meaningfulChild.endIndex}):`, JSON.stringify(childChunks, null, 2));

            // Always create a separate chunk for prefix text if it exists
            if (accumulatedPrefix.length > 0) {
                 chunks.push(createChunk(
                    document, accumulatedPrefix, lastMeaningfulChildEnd, meaningfulChild.startIndex, chunkCounter.index++,
                    { nodeType: 'text_between_nodes', language: language }
                ));
                accumulatedPrefix = ""; // Reset prefix
            }

            chunks.push(...childChunks);
            // console.log(`[After Push] chunks array state after adding childChunks for ${meaningfulChild.type}:`, JSON.stringify(chunks, null, 2)); // Keep one log if needed
            lastMeaningfulChildEnd = meaningfulChild.endIndex;
        }

        // console.log('[Suffix Check] Last Chunk Before Suffix Logic:', JSON.stringify(chunks[chunks.length - 1], null, 2)); // Keep if needed
        const suffixText = document.content.substring(lastMeaningfulChildEnd, node.endIndex).trim();
        // Always create a separate chunk for suffix text if it exists
        if (suffixText.length > 0) {
             chunks.push(createChunk(
                document, suffixText, lastMeaningfulChildEnd, node.endIndex, chunkCounter.index++,
                { nodeType: 'text_after_last_meaningful', language: language }
            ));
        }

    } else if (!fits) {
        console.warn(`Node type '${node.type}' exceeded maxSize (${options.maxChunkSize}) and has no meaningful children. Applying fallback text splitting.`, { nodeId: document.id, nodeTextLength: nodeText.length });
        const textChunks = splitTextWithOverlap(nodeText, options.maxChunkSize, options.chunkOverlap);
        textChunks.forEach((textChunk: string, idx: number) => {
            chunks.push(createChunk(
                document, textChunk, node.startIndex, node.endIndex, chunkCounter.index++, 
                { nodeType: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, language: language, warning: `Fallback split applied to large node without meaningful children (${idx + 1}/${textChunks.length})` }
            ));
        });
    } else {
         chunks.push(createChunk(
            document, nodeText, node.startIndex, node.endIndex, chunkCounter.index++,
            { nodeType: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, language: language, note: 'Node fits but is not a boundary type' }
        ));
    }

    if (chunks.length === 0 && !fits) {
        console.warn(`Node type '${node.type}' exceeded maxSize (${options.maxChunkSize}) and recursion yielded no chunks. Applying fallback text splitting to original node text.`, { nodeId: document.id });
        const textChunks = splitTextWithOverlap(nodeText, options.maxChunkSize, options.chunkOverlap);
        textChunks.forEach((textChunk: string, idx: number) => {
            chunks.push(createChunk(
                document, textChunk, node.startIndex, node.endIndex, chunkCounter.index++,
                { nodeType: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, language: language, warning: `Fallback split applied to large node after failed recursion (${idx + 1}/${textChunks.length})` }
            ));
        });
    }

    return chunks;
}


/**
 * Chunks code based on its AST or falls back to text splitting.
 */
export async function chunkCodeAst(
    code: string,
    language: SupportedLanguage | null,
    options?: ChunkingOptions,
    baseMetadata: Record<string, any> = {}
): Promise<Chunk[]> {
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
        const tree = await parseCode(code, language);
        if (!tree) throw new Error('Parsing returned null tree');

        const chunks = await traverseAndChunk(tree.rootNode, document, mergedOptions, language, chunkCounter);

        if (chunks.length === 0 && code.length > 0) {
             console.warn(`AST chunking for ${language} yielded no chunks, applying fallback text splitting.`);
             const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
             return textChunks.map((textChunk: string, idx: number) => createChunk(document, textChunk, -1, -1, chunkCounter.index++, { language: language, warning: 'Fallback text splitting applied (no AST chunks)' }));
        }
        return chunks;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`AST parsing failed for language ${language}. Applying fallback text splitting.`, error, { codeSnippet: code.substring(0, 100) });
        console.log('[chunkCodeAst CATCH] Error:', error);
        const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
        // Ensure warning is added here
        const fallbackChunks = textChunks.map((textChunk: string, idx: number) => createChunk(
            document,
            textChunk,
            -1, -1,
            chunkCounter.index++,
            {
                language: language,
                warning: `Fallback text splitting applied (parsing error: ${errorMessage})`, // Corrected line
                fallbackIndex: idx + 1,
                fallbackTotal: textChunks.length
            }
        ));
        console.log('[chunkCodeAst CATCH] Created fallback chunks:', JSON.stringify(fallbackChunks, null, 2));
        return fallbackChunks;
    }
}
