import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
// Import necessary functions and types from the rag package
import { detectLanguage, chunkCodeAst, generateEmbeddings } from '../index.js';
import type { IndexManager, IndexedItem } from '../indexManager.js';
import type { RagToolExecuteOptions, Document, Chunk, RagContext } from '../types.js'; // Import RagContext
import { RagContextSchema } from '../types.js'; // Import schema

// --- Input Schema ---
const ManualIndexInputSchema = z.object({
  filePath: z.string().min(1, 'filePath is required.'),
  returnChunks: z.boolean().optional().default(false).describe('If true, returns generated chunks instead of indexing them.'),
  maxChunksToReturn: z.number().int().positive().optional().default(10).describe('Max number of chunks to return if returnChunks is true.'),
});

// --- TypeScript Type ---
export type ManualIndexInput = z.infer<typeof ManualIndexInputSchema>;

// --- Output Types ---
// Define what metadata we want to return for each chunk
const ChunkMetadataSchema = z.record(z.any()).and(z.object({
    chunkIndex: z.number().optional(),
    originalId: z.string().optional(),
    filePath: z.string().optional(),
    fileMtime: z.number().optional(),
    nodeType: z.string().optional(),
    warning: z.string().optional(),
    error: z.string().optional(),
}));

// Define the structure for returned chunks if requested
const ReturnedChunkSchema = z.object({
    content: z.string(),
    metadata: ChunkMetadataSchema.optional(),
});

export interface ManualIndexResult {
  success: boolean;
  filePath: string;
  message: string;
  chunksUpserted?: number;
  returnedChunks?: z.infer<typeof ReturnedChunkSchema>[]; // Add field for returned chunks
  error?: string;
}

const ManualIndexResultSchema = z.object({
    success: z.boolean(),
    filePath: z.string(),
    message: z.string(),
    chunksUpserted: z.number().int().nonnegative().optional(),
    returnedChunks: z.array(ReturnedChunkSchema).optional(), // Add schema field
    error: z.string().optional(),
});

const ManualIndexOutputSchema = z.array(ManualIndexResultSchema);

// --- Tool Definition ---
// Generic parameters are now inferred from the definition object
export const manualIndexFileTool = defineTool({
  name: 'manual-index-file',
  description: 'Manually triggers the indexing process (chunk, embed, upsert) for a specific file, or optionally returns the generated chunks for debugging.',
  inputSchema: ManualIndexInputSchema,
  contextSchema: RagContextSchema, // Add the context schema

  execute: async (
    // Context type is inferred from RagContextSchema
    { context, args }: { context: RagContext; args: ManualIndexInput } // Use destructuring
  ): Promise<Part[]> => {
    // Validate args
    const parsed = ManualIndexInputSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Input validation failed: ${parsed.error.message}`);
    }
    const { filePath, returnChunks, maxChunksToReturn } = parsed.data; // Relative path

    // Access context properties
    const { indexManager, workspaceRoot, ragConfig } = context;

    if (!indexManager || !indexManager.isInitialized()) { /* ... error handling ... */
        return [jsonPart([{ success: false, filePath, message: "IndexManager not available or not initialized." }], ManualIndexOutputSchema)];
    }
    if (!workspaceRoot) { /* ... error handling ... */
        return [jsonPart([{ success: false, filePath, message: "workspaceRoot not found in context." }], ManualIndexOutputSchema)]; // Updated message
    }
     if (!ragConfig) { /* ... error handling ... */
        return [jsonPart([{ success: false, filePath, message: "ragConfig not found in context." }], ManualIndexOutputSchema)]; // Updated message
    }
     if (returnChunks && !maxChunksToReturn) {
         // Should be handled by default value, but safeguard
         return [jsonPart([{ success: false, filePath, message: "maxChunksToReturn is required when returnChunks is true." }], ManualIndexOutputSchema)];
     }

    const absolutePath = path.join(workspaceRoot, filePath);
    let result: ManualIndexResult;

    try {
        const stats = await fs.stat(absolutePath);
        const currentMtime = stats.mtimeMs;
        const content = await fs.readFile(absolutePath, 'utf-8');
        const doc: Document = { id: filePath, content: content, metadata: { filePath: filePath, fileMtime: currentMtime } };
        const language = detectLanguage(filePath);

        // Pass undefined for chunking options to use defaults defined in chunkCodeAst
        const chunks = await chunkCodeAst(doc.content, language, undefined, doc.metadata);

        if (chunks.length === 0) {
             result = { success: true, filePath, message: "No chunks generated.", chunksUpserted: 0 };
        } else if (returnChunks) {
            // Return chunks instead of indexing
            const chunksToReturn = chunks.slice(0, maxChunksToReturn).map(c => ({
                content: c.content,
                metadata: c.metadata,
            }));
            result = {
                success: true,
                filePath,
                message: `Returning ${chunksToReturn.length} of ${chunks.length} generated chunks.`,
                returnedChunks: chunksToReturn,
            };
        } else {
            // Proceed with embedding and upserting
            const embeddings = await generateEmbeddings(chunks, ragConfig.embedding);
            if (embeddings.length !== chunks.length) {
                throw new Error('Mismatch between number of chunks and generated embeddings.');
            }

            const indexedItems: IndexedItem[] = chunks.map((chunk, index) => {
                const chunkId = `${filePath}::${chunk.metadata?.chunkIndex ?? index}`;
                const finalMetadata = { ...chunk.metadata, fileMtime: currentMtime };
                return {
                    ...chunk,
                    metadata: finalMetadata,
                    id: chunkId,
                    vector: embeddings[index],
                };
            });

            await indexManager.upsertItems(indexedItems);

             result = { success: true, filePath, message: `Successfully indexed ${indexedItems.length} chunks.`, chunksUpserted: indexedItems.length };
        }

    } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        result = { success: false, filePath, message: `Error processing file: ${errorMsg}`, error: errorMsg };
    }

    return [jsonPart([result], ManualIndexOutputSchema)]; // Wrap result in array
  },
});