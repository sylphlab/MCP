import Parser, { Tree, Language } from 'web-tree-sitter'; // Revert import
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
  // metadata removed from options, should be part of the Document
}

// Node types that represent good chunk boundaries per language
const CHUNK_BOUNDARY_TYPES: Partial<Record<SupportedLanguage, string[]>> = {
  [SupportedLanguage.JavaScript]: ['function_declaration', 'class_declaration', 'method_definition', 'lexical_declaration', 'variable_declaration', 'export_statement', 'comment'],
  [SupportedLanguage.TypeScript]: ['function_declaration', 'class_declaration', 'method_definition', 'lexical_declaration', 'variable_declaration', 'export_statement', 'interface_declaration', 'type_alias_declaration', 'comment'],
  [SupportedLanguage.TSX]: ['function_declaration', 'class_declaration', 'method_definition', 'lexical_declaration', 'variable_declaration', 'export_statement', 'interface_declaration', 'type_alias_declaration', 'jsx_element', 'jsx_self_closing_element', 'comment'],
  [SupportedLanguage.Python]: ['function_definition', 'class_definition', 'comment'],
  // Markdown is handled separately in chunkCodeAst
};

// --- Helper Functions ---

/** Moved from test file */
function splitTextWithOverlap(text: string, maxSize: number, overlap: number): string[] {
    if (text.length <= maxSize) {
        return [text];
    }
    const chunks: string[] = [];
    let start = 0;
    const step = Math.max(1, maxSize - overlap); // Ensure progress

    while (start < text.length) {
        const end = Math.min(start + maxSize, text.length);
        chunks.push(text.substring(start, end));
        start += step;
    }

    // Remove potential duplicate last chunk if step is small
    if (chunks.length > 1 && text.endsWith(chunks[chunks.length-1]) && chunks[chunks.length-2].endsWith(chunks[chunks.length-1])) {
       // This condition is complex, let's simplify or remove for now.
       // The core issue was the loop logic.
    }

    // Re-check for simple duplicate last chunk caused by final step
     if (chunks.length > 1) {
        const lastChunk = chunks[chunks.length - 1];
        const secondLastChunk = chunks[chunks.length - 2];
        // If the second last chunk *ends with* the entire last chunk (due to overlap)
        // and the last chunk isn't the *only* content remaining.
        if (start - step + maxSize > text.length && secondLastChunk.endsWith(lastChunk)) {
             // This check is also complex. Let's rely on the simpler loop first.
             // A better check might be needed later if duplicates appear.
        }
     }


    // Original duplicate check - might still be relevant depending on step/overlap
    if (chunks.length > 1) {
        const lastChunk = chunks[chunks.length - 1];
        const secondLastChunk = chunks[chunks.length - 2];
        if (secondLastChunk.endsWith(lastChunk)) {
            chunks.pop();
        }
    }
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
    return {
        ...document,
        id: `${document.id}::chunk_${chunkIndex}`,
        content: content,
        startPosition: startIndex,
        endPosition: endIndex,
        metadata: {
            ...document.metadata,
            chunkIndex: chunkIndex,
            originalId: document.id,
            ...metadata,
        }
    };
}

/** Re-add detectLanguage function */
function detectLanguage(filePath: string): SupportedLanguage | null {
    const extension = path.extname(filePath).toLowerCase().substring(1); // Use path.extname and remove leading dot
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
        // case 'go': // Add Go if/when parser/wasm is handled
        //     return SupportedLanguage.Go;
        // case 'rs': // Add Rust if/when parser/wasm is handled
        //     return SupportedLanguage.Rust;
        // case 'html': // Add HTML if/when parser/wasm is handled
        // case 'htm':
        //     return SupportedLanguage.HTML;
        // case 'css': // Add CSS if/when parser/wasm is handled
        //     return SupportedLanguage.CSS;
        // case 'json': // Add JSON if/when parser/wasm is handled
        //     return SupportedLanguage.JSON;
        // case 'md': // Add Markdown if/when parser/wasm is handled
        // case 'markdown':
        //     return SupportedLanguage.Markdown;
        default:
            console.log(`No specific parser found for extension ".${extension}", will use text chunking.`);
            return null; // Treat as plain text
    }
}


/**
 * Recursive function to traverse the AST and create chunks.
 * Prioritizes splitting based on meaningful children.
 */
async function traverseAndChunk(
    node: any, // Use any for node type
    document: Document,
    options: Required<Omit<ChunkingOptions, 'metadata'>>,
    language: SupportedLanguage,
    chunkCounter: { index: number }
): Promise<Chunk[]> {
    const chunks: Chunk[] = [];
    const nodeText = node.text;
    const boundaryTypes = CHUNK_BOUNDARY_TYPES[language] || [];

    // Base Case 1: Node is small enough AND is a preferred boundary type
    const isBoundary = boundaryTypes.includes(node.type);
    const fits = nodeText.length <= options.maxChunkSize;

    if (fits && isBoundary) {
        chunks.push(createChunk(
            document, nodeText, node.startIndex, node.endIndex, chunkCounter.index++,
            { nodeType: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, language: language }
        ));
        return chunks;
    }

    // Check for meaningful children to guide splitting
    const meaningfulChildren = node.children?.filter((child: any) => boundaryTypes.includes(child.type)) || [];

    if (meaningfulChildren.length > 0) {
        // Recursive Case: Split based on meaningful children
        let lastMeaningfulChildEnd = node.startIndex;
        let accumulatedPrefix = ""; // Accumulate text between meaningful children

        for (const meaningfulChild of meaningfulChildren) {
            // Capture text between the last meaningful node and this one
            const prefixText = document.content.substring(lastMeaningfulChildEnd, meaningfulChild.startIndex).trim();
            accumulatedPrefix += (accumulatedPrefix ? "\n\n" : "") + prefixText; // Add separator if needed

            // Recurse on the meaningful child
            const childChunks = await traverseAndChunk(meaningfulChild, document, options, language, chunkCounter);

            // Try to prepend the accumulated prefix to the first chunk from the child recursion
            if (childChunks.length > 0 && accumulatedPrefix.length > 0) {
                const combinedPrefixContent = accumulatedPrefix + "\n\n" + childChunks[0].content;
                if (combinedPrefixContent.length <= options.maxChunkSize) {
                    childChunks[0].content = combinedPrefixContent;
                    childChunks[0].startPosition = lastMeaningfulChildEnd; // Adjust start position
                    childChunks[0].metadata = {
                        ...(childChunks[0].metadata || {}),
                        nodeType: `text_before+${childChunks[0].metadata?.nodeType || 'unknown'}`,
                    };
                    accumulatedPrefix = ""; // Reset prefix
                } else {
                    // Prefix is too large, create a separate chunk for it
                     chunks.push(createChunk(
                        document, accumulatedPrefix, lastMeaningfulChildEnd, meaningfulChild.startIndex, chunkCounter.index++,
                        { nodeType: 'text_between_nodes', language: language }
                    ));
                    accumulatedPrefix = ""; // Reset prefix
                }
            } else if (accumulatedPrefix.length > 0) {
                 // Child recursion yielded no chunks, but we have a prefix
                 chunks.push(createChunk(
                    document, accumulatedPrefix, lastMeaningfulChildEnd, meaningfulChild.startIndex, chunkCounter.index++,
                    { nodeType: 'text_between_nodes', language: language }
                ));
                accumulatedPrefix = ""; // Reset prefix
            }

            chunks.push(...childChunks); // Add chunks from the meaningful child
            lastMeaningfulChildEnd = meaningfulChild.endIndex;
        }

        // Handle any remaining text after the last meaningful child
        const suffixText = document.content.substring(lastMeaningfulChildEnd, node.endIndex).trim();
        if (suffixText.length > 0) {
            // Try appending to the last chunk if possible, otherwise create new
            const lastChunk = chunks[chunks.length - 1];
            if (lastChunk) {
                 const combinedSuffixContent = lastChunk.content + "\n\n" + suffixText;
                 if (combinedSuffixContent.length <= options.maxChunkSize) {
                     lastChunk.content = combinedSuffixContent;
                     lastChunk.endPosition = node.endIndex;
                     lastChunk.metadata = {
                         ...(lastChunk.metadata || {}),
                         nodeType: `${lastChunk.metadata?.nodeType || 'unknown'}+text_after`,
                         endLine: node.endPosition.row + 1, // Update end line
                     };
                 } else {
                     chunks.push(createChunk(
                        document, suffixText, lastMeaningfulChildEnd, node.endIndex, chunkCounter.index++,
                        { nodeType: 'text_after_last_meaningful', language: language }
                    ));
                 }
            } else {
                 chunks.push(createChunk(
                    document, suffixText, lastMeaningfulChildEnd, node.endIndex, chunkCounter.index++,
                    { nodeType: 'text_after_last_meaningful', language: language }
                ));
            }
        }

    } else if (!fits) {
        // Base Case 2 (Revised): Node is too large AND has NO meaningful children
        console.warn(`Node type '${node.type}' exceeded maxSize (${options.maxChunkSize}) and has no meaningful children. Applying fallback text splitting.`, { nodeId: document.id, nodeTextLength: nodeText.length });
        const textChunks = splitTextWithOverlap(nodeText, options.maxChunkSize, options.chunkOverlap);
        textChunks.forEach((textChunk: string, idx: number) => {
            chunks.push(createChunk(
                document, textChunk, node.startIndex, node.endIndex, chunkCounter.index++,
                { nodeType: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, language: language, warning: `Fallback split applied to large node without meaningful children (${idx + 1}/${textChunks.length})` }
            ));
        });
    } else {
         // Base Case 3: Node fits but is not a boundary type (and has no meaningful children)
         // Treat it as a single chunk.
         chunks.push(createChunk(
            document, nodeText, node.startIndex, node.endIndex, chunkCounter.index++,
            { nodeType: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, language: language, note: 'Node fits but is not a boundary type' }
        ));
    }


    // Final fallback if recursion somehow yielded no chunks for a large node
    // This condition should ideally not be hit with the new logic, but kept as a safeguard
    if (chunks.length === 0 && !fits && meaningfulChildren.length === 0) {
        console.warn(`Node type '${node.type}' exceeded maxSize (${options.maxChunkSize}) and recursion yielded no chunks. Applying fallback text splitting to original node.`, { nodeId: document.id });
        const textChunks = splitTextWithOverlap(nodeText, options.maxChunkSize, options.chunkOverlap);
        textChunks.forEach((textChunk: string, idx: number) => {
            chunks.push(createChunk(
                document, textChunk, node.startIndex, node.endIndex, chunkCounter.index++,
                { nodeType: node.type, startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1, language: language, warning: `Fallback split applied to large node after recursion (${idx + 1}/${textChunks.length})` }
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
    // Pass optional base metadata separately
    baseMetadata: Record<string, any> = {}
): Promise<Chunk[]> {
    // Merge options, excluding metadata
    const mergedOptions: Required<Omit<ChunkingOptions, 'metadata'>> = {
        maxChunkSize: options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE,
        chunkOverlap: options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
    };
    // Create document with base metadata
    const document: Document = {
        id: baseMetadata?.source || 'code_snippet', // Use source from metadata if available
        content: code,
        metadata: { language, ...baseMetadata }
    };
    const chunkCounter = { index: 0 };

    // --- Markdown Handling ---
    // Note: Markdown AST chunking is complex due to inline/block distinction and potential recursion.
    // Deferring full Markdown AST implementation for now. Fallback to text chunking for Markdown.
    if (language === SupportedLanguage.Markdown) {
        console.warn('Markdown AST chunking deferred. Applying fallback text splitting.');
        const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
        return textChunks.map((textChunk: string, idx: number) => createChunk(document, textChunk, -1, -1, chunkCounter.index++, { language: language, warning: `Fallback text splitting applied (Markdown AST deferred)` }));
    }

    // --- Generic Language Handling ---
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
        const textChunks = splitTextWithOverlap(code, mergedOptions.maxChunkSize, mergedOptions.chunkOverlap);
        // Ensure the warning is included in the metadata here
        return textChunks.map((textChunk: string, idx: number) => createChunk(
            document,
            textChunk,
            -1, -1, // Positions are inaccurate in fallback
            chunkCounter.index++,
            {
                language: language, // Keep original language if known
                warning: `Fallback text splitting applied (parsing error: ${errorMessage})`,
                fallbackIndex: idx + 1,
                fallbackTotal: textChunks.length
            }
        ));
    }
}

// Remove original chunkDocument if chunkCodeAst is the main entry point now.
// export async function chunkDocument(doc: Document, options?: ChunkingOptions): Promise<Chunk[]> {
//     const language = detectLanguage(doc.id); // Detect language from document ID/path
//     // Pass document metadata (including ID) into chunkCodeAst options
//     const combinedOptions = { ...(options || {}), metadata: { source: doc.id, ...(doc.metadata || {}) } };
//     return chunkCodeAst(doc.content, language, combinedOptions);
// }

/**
 * Simple text chunking with fixed size and overlap, creating Chunk objects.
 */
function chunkByText( // Keep this as it's used by chunkCodeAst fallback
    document: Document,
    maxSize: number = DEFAULT_MAX_CHUNK_SIZE,
    overlap: number = DEFAULT_CHUNK_OVERLAP
): Chunk[] {
   const textChunks = splitTextWithOverlap(document.content, maxSize, overlap); // Use local function
   let chunkIndex = document.metadata?.chunkIndex ?? 0; // Start index if provided
   return textChunks.map((textChunk: string) => createChunk( // Add type
       document,
       textChunk,
       -1, -1, // Positions are not accurate here
       chunkIndex++,
       { ...(document.metadata || {}), originalId: document.id } // Ensure originalId is preserved
   ));
}