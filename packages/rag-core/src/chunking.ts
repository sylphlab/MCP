import { z } from 'zod';
import { parseCode, SupportedLanguage } from './parsing.js'; // Add .js
import { Parser, Language, Tree } from 'web-tree-sitter';
import { Chunk } from './types.js'; // Add .js (Re-applying)

// TODO: Define specific AST node types if needed for different languages

export const ChunkingOptionsSchema = z.object({
  maxChunkSize: z.number().int().positive().default(1000), // Max characters or tokens? Define clearly.
  chunkOverlap: z.number().int().nonnegative().default(100), // Overlap in characters or tokens?
  // Add language-specific options if necessary
});

export type ChunkingOptions = z.infer<typeof ChunkingOptionsSchema>;

// Helper function for basic text splitting with overlap
function splitTextWithOverlap(text: string, maxSize: number, overlap: number): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    // Adjust start for overlap, ensuring it doesn't go below 0
    const chunkStart = start > 0 ? Math.max(0, start - overlap) : start;
    chunks.push(text.substring(chunkStart, end));

    // Move start for the next chunk
    start = end;
    // If the next theoretical start point (end - overlap) is beyond the text length, we're done.
    // This prevents creating an unnecessary tiny chunk at the very end just for overlap.
    if (end === text.length || end - overlap >= text.length) {
         break;
    }
     // Prepare next chunk's ideal start, considering overlap, but don't modify 'start' directly here
     // as the loop condition uses 'start'. The overlap is handled by 'chunkStart' above.
     // Let the next iteration calculate the correct chunkStart based on the new 'start' (which is 'end').
  }
   // Final check: If the loop finished but didn't capture the very end due to overlap logic, add the last piece.
   // This scenario is less likely with the refined loop break condition but kept as a safeguard.
   // Re-evaluate if this is truly needed after testing.
   // const lastChunkEnd = chunks.length > 0 ? text.indexOf(chunks[chunks.length - 1]) + chunks[chunks.length - 1].length : 0;
   // if (lastChunkEnd < text.length) {
   //    chunks.push(text.substring(lastChunkEnd));
   // }


  return chunks;
}


/**
 * Chunks source code based on its Abstract Syntax Tree (AST).
 * Aims to keep related code blocks (functions, classes, etc.) together.
 *
 * @param code The source code content.
 * @param language The programming language of the code.
 * @param options Chunking parameters.
 * @returns An array of code chunks.
 */
export async function chunkCodeAst(
  code: string,
  language: SupportedLanguage | null, // Allow null for fallback/text
  options: ChunkingOptions = ChunkingOptionsSchema.parse({})
): Promise<Chunk[]> {
  console.log(`Chunking code for language: ${language} with options:`, options);
  // TODO: 1. Parse the code into an AST using a suitable parser (e.g., tree-sitter via a 'parsing.ts' module).
  // const ast = await parse(code, language);

  // TODO: 2. Traverse the AST. Identify meaningful top-level nodes (functions, classes, interfaces, etc.).
  //          For Markdown, identify code blocks (` ``` `).

  // TODO: 3. Implement recursive chunking:
  //          - Start with top-level nodes.
  //          - If a node's content exceeds maxChunkSize, recursively chunk its children.
  //          - For Markdown code blocks:
  //              - Extract the language identifier (e.g., ```typescript).
  //              - Recursively call chunkCodeAst for the code block content and its language.
  //              - Treat the results as sub-chunks within the Markdown chunk.
  //          - Handle nested structures in other languages appropriately.

  // TODO: 4. Apply chunkOverlap logic during chunk creation/concatenation.

  // TODO: 5. Format the output chunks (potentially adding metadata later - line numbers, node type).

  // 1. Parse the code into an AST *if* language is supported
  let rootNode: any; // Use any temporarily due to conditional parsing
  if (language) {
      try {
          const tree = await parseCode(code, language);
          rootNode = tree.rootNode;
      } catch (parseError) {
          console.warn(`AST parsing failed for language ${language}:`, parseError, 'Falling back to text splitting.');
          rootNode = null; // Indicate fallback needed
      }
  } else {
      rootNode = null; // Fallback if no language provided/detected
  }

  // If AST parsing failed or wasn't attempted, use fallback
  if (!rootNode) {
      console.log('Applying fallback text splitting.');
      const fallbackContentChunks = splitTextWithOverlap(code, options.maxChunkSize, options.chunkOverlap);
      return fallbackContentChunks.map(content => ({
         content: content,
         metadata: {
            warning: 'Fallback text split applied',
            // We don't know the language for sure here
         }
      }));
  }

  // Recursive async chunking function
  // TODO: Resolve type for 'node'. Using 'any' as explicit SyntaxNode/Parser.SyntaxNode failed.
  const traverseAndChunk = async (node: any): Promise<Chunk[]> => {
    if (!node) {
      return []; // Base case: null node
    }

    const nodeText = node.text;

    // Base case: Node text fits within the max chunk size
    // TODO: Refine this condition, consider overlap allowance
    if (nodeText.length <= options.maxChunkSize) {
      // TODO: Add check for minimum chunk size? Avoid tiny chunks?

      // If base case applies (node fits max size):
      // Markdown block handling removed as Markdown parsing is deferred
      return [{ // Return node text as a single Chunk object
         content: nodeText,
         metadata: {
            nodeType: node.type,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            language: language ?? undefined, // Assign language or undefined if null
        }
      }];
    }

    // Recursive step: Node is too large, chunk its children
    let currentChunks: Chunk[] = []; // Store Chunk objects
    for (const child of node.children) {
      // Skip children already handled within special blocks (like code content)?
      // For now, process all children. Refine if needed based on grammar.
      const childChunks = await traverseAndChunk(child); // Await the recursive async call

      // --- Intelligent Combination Logic ---
      if (childChunks.length === 0) continue; // Skip if child yielded no chunks

      let remainingChildChunks = [...childChunks];

      while (remainingChildChunks.length > 0) {
        const subChunk = remainingChildChunks.shift()!; // Take the next chunk from the child

        if (currentChunks.length === 0) {
          // If this is the very first chunk being added, just add it.
           currentChunks.push(subChunk);
           continue;
        }

        let lastCurrentChunk = currentChunks[currentChunks.length - 1];
        const overlapText = lastCurrentChunk.content.slice(-options.chunkOverlap); // Use .content
        const textToAppend = subChunk.content.startsWith(overlapText) // Use .content
                             ? subChunk.content.slice(overlapText.length) // Use .content
                             : subChunk.content; // Use .content

        const combinedLength = lastCurrentChunk.content.length + textToAppend.length; // Use .content

        if (combinedLength <= options.maxChunkSize) {
          // Append content and merge metadata
          currentChunks[currentChunks.length - 1].content += textToAppend; // Modify .content
          currentChunks[currentChunks.length - 1].metadata = { // Merge metadata
             ...lastCurrentChunk.metadata,
             ...subChunk.metadata,
             endLine: subChunk.metadata?.endLine ?? lastCurrentChunk.metadata?.endLine,
          };
        } else {
          // Start a new chunk with overlap
          const newChunkStartText = lastCurrentChunk.content.slice(-options.chunkOverlap); // Use .content
          const newChunkText = newChunkStartText + (subChunk.content.startsWith(newChunkStartText) ? subChunk.content.slice(newChunkStartText.length) : subChunk.content); // Use .content

          if (newChunkText.length > options.maxChunkSize) {
             console.warn(`Sub-chunk (type: ${child?.type}, length: ${subChunk.content.length}) combined with overlap still exceeds max size. Splitting sub-chunk content.`); // Use .content
             // Split the problematic subChunk *content*
             const splitSubChunkContents = splitTextWithOverlap(subChunk.content, options.maxChunkSize - newChunkStartText.length, options.chunkOverlap); // Use .content

             // Create new Chunk for the first part
             currentChunks.push({ // Push Chunk object
                content: newChunkStartText + splitSubChunkContents[0],
                metadata: {
                   ...lastCurrentChunk.metadata,
                   ...subChunk.metadata,
                   startLine: lastCurrentChunk.metadata?.endLine ? lastCurrentChunk.metadata.endLine - Math.min(options.chunkOverlap, (lastCurrentChunk.metadata.endLine - (lastCurrentChunk.metadata.startLine ?? 0))) : subChunk.metadata?.startLine,
                }
             });

             // Create remaining chunks from the split and put them back in the queue
             const remainingSplitChunks: Chunk[] = splitSubChunkContents.slice(1).map(splitContent => ({ // Map string[] to Chunk[]
                content: splitContent,
                metadata: { ...subChunk.metadata }
             }));
             remainingChildChunks.unshift(...remainingSplitChunks); // Unshift Chunk[]

          } else {
             // Create a new chunk with overlap
             currentChunks.push({ // Push Chunk object
                content: newChunkText,
                metadata: {
                   ...lastCurrentChunk.metadata,
                   ...subChunk.metadata,
                   startLine: lastCurrentChunk.metadata?.endLine ? lastCurrentChunk.metadata.endLine - Math.min(options.chunkOverlap, (lastCurrentChunk.metadata.endLine - (lastCurrentChunk.metadata.startLine ?? 0))) : subChunk.metadata?.startLine,
                   endLine: subChunk.metadata?.endLine,
                }
             });
          }
        }
      }
      // --- End Intelligent Combination Logic ---
    }

    // If chunking children resulted in no chunks (e.g., only comments/whitespace),
    // but the node itself has text, we might need a fallback for this node.
    // TODO: Implement fallback splitting (e.g., character-based) for large nodes
    //       that cannot be meaningfully subdivided by children.
    if (currentChunks.length === 0 && nodeText.length > 0) {
       // Apply fallback splitting for large nodes that couldn't be subdivided
       console.warn(`Node type ${node.type} too large (${nodeText.length}) and yielded no child chunks. Applying fallback split.`);
       const fallbackContentChunks = splitTextWithOverlap(nodeText, options.maxChunkSize, options.chunkOverlap);
       currentChunks = fallbackContentChunks.map(content => ({
          content: content,
          metadata: {
             nodeType: node.type,
             startLine: node.startPosition.row + 1, // Approximate
             endLine: node.endPosition.row + 1,   // Approximate
             language: language ?? undefined, // Assign language or undefined
             warning: 'Fallback split applied',
          }
       }));
    }


    return currentChunks;
  };

  // Start traversal from the root node
  let chunks = await traverseAndChunk(rootNode); // Await the initial async call

  // Final fallback if AST traversal yielded nothing but the code isn't empty
  if (chunks.length === 0 && rootNode.text.length > 0) {
    console.warn("AST traversal yielded no chunks. Applying root fallback split.");
    const fallbackContentChunks = splitTextWithOverlap(rootNode.text, options.maxChunkSize, options.chunkOverlap);
    chunks = fallbackContentChunks.map(content => ({
       content: content,
       metadata: {
          startLine: rootNode.startPosition.row + 1, // Approximate
          endLine: rootNode.endPosition.row + 1,   // Approximate
          language: language ?? undefined, // Assign language or undefined
          warning: 'Root fallback split applied',
       }
    }));
  }

  // TODO: Post-process chunks? Apply overlap more consistently? Merge small adjacent chunks?

  return chunks;
}

// Example usage (for testing/dev):
// async function run() {
//   const sampleCode = `
// function hello() {
//   console.log("Hello");
// }
//
// class Greeter {
//   greeting: string;
//   constructor(message: string) {
//     this.greeting = message;
//   }
//   greet() {
//     return "Hello, " + this.greeting;
//   }
// }
//   `;
//   const chunks = await chunkCodeAst(sampleCode, 'typescript', { maxChunkSize: 50, chunkOverlap: 10 });
//   console.log("Chunks:", chunks);
// }
// run();