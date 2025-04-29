import { defineTool, jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import type { IndexManager } from '../indexManager.js';
import type { RagToolExecuteOptions } from '../types.js';

// --- Input Schema ---
const GetChunksInputSchema = z.object({
  filePath: z.string().min(1, 'filePath is required.'),
});

// --- TypeScript Type ---
export type GetChunksInput = z.infer<typeof GetChunksInputSchema>;

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
    // Add other relevant metadata fields if needed
}));

export interface GetChunksResult {
  success: boolean;
  filePath: string;
  chunkCount: number;
  chunksMetadata: z.infer<typeof ChunkMetadataSchema>[];
  error?: string;
}

const GetChunksResultSchema = z.object({
    success: z.boolean(),
    filePath: z.string(),
    chunkCount: z.number().int().nonnegative(),
    chunksMetadata: z.array(ChunkMetadataSchema),
    error: z.string().optional(),
});

const GetChunksOutputSchema = z.array(GetChunksResultSchema);


// --- Tool Definition ---
export const getChunksForFileTool = defineTool({
  name: 'get-chunks-for-file',
  description: 'Retrieves the metadata for all indexed chunks associated with a specific file path.',
  inputSchema: GetChunksInputSchema,

  execute: async (input: GetChunksInput, options: ToolExecuteOptions): Promise<Part[]> => {
    const parsed = GetChunksInputSchema.safeParse(input);
    if (!parsed.success) {
      // ... (Input validation error handling) ...
      throw new Error(`Input validation failed: ${parsed.error.message}`);
    }
    const { filePath } = parsed.data;

    const ragOptions = options as RagToolExecuteOptions;
    if (!ragOptions.indexManager || !ragOptions.indexManager.isInitialized()) {
      return [jsonPart([{
          success: false,
          filePath: filePath,
          chunkCount: 0,
          chunksMetadata: [],
          error: 'IndexManager not available or not initialized.',
      }], GetChunksOutputSchema)];
    }

    const indexManager = ragOptions.indexManager;
    let results: GetChunksResult;

    try {
        const metadataMap = await indexManager.getChunksMetadataByFilePath(filePath);

        if (metadataMap === null) {
            // Indicates an error occurred during retrieval
             results = {
                success: false,
                filePath: filePath,
                chunkCount: 0,
                chunksMetadata: [],
                error: `Failed to retrieve metadata for ${filePath}. Check service logs.`,
            };
        } else {
            const metadataArray = Array.from(metadataMap.values());
            results = {
                success: true,
                filePath: filePath,
                chunkCount: metadataArray.length,
                chunksMetadata: metadataArray,
            };
        }
    } catch (e: unknown) {
         results = {
            success: false,
            filePath: filePath,
            chunkCount: 0,
            chunksMetadata: [],
            error: e instanceof Error ? e.message : 'Unknown error retrieving chunk metadata.',
        };
    }

    return [jsonPart([results], GetChunksOutputSchema)];
  },
});