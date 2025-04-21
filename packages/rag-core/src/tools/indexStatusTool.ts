import path from 'node:path'; // Import path
// Correct imports based on core/src/index.ts
import type {
  BaseMcpToolOutput,
  McpContentPart,
  McpTool,
  McpToolExecuteOptions,
} from '@sylphlab/mcp-core';
// Removed VercelAIEmbeddingFunction import
import type { IEmbeddingFunction } from 'chromadb'; // Import IEmbeddingFunction type
import { z } from 'zod';
import { getRagCollection } from '../chroma.js';

// Define Input Schema using Zod (optional, could be empty)
const IndexStatusInput = z.object({}).optional(); // No input needed

// Define Output Type extending BaseMcpToolOutput
interface IndexStatusOutput extends BaseMcpToolOutput {
  count: number;
  collectionName: string;
}

// Implement the tool
export const indexStatusTool: McpTool<typeof IndexStatusInput, IndexStatusOutput> = {
  name: 'getIndexStatus',
  description: 'Gets the status of the RAG index (e.g., number of items).',
  inputSchema: IndexStatusInput, // Use Zod schema directly

  // Correct execute signature
  async execute(
    _input: z.infer<typeof IndexStatusInput>,
    options: McpToolExecuteOptions,
  ): Promise<IndexStatusOutput> {
    // Remove workspaceRoot, require options
    try {
      // Determine chromaDbPath using options.workspaceRoot
      const chromaDbPath = path.join(options.workspaceRoot, '.mcp', 'chroma_db'); // Use options.workspaceRoot

      // Create a minimal dummy embedding function locally just to satisfy getRagCollection's type requirement
      // This avoids needing to import/configure a real embedding model for a simple status check.
      // TODO: Consider refactoring getRagCollection or ChromaClient interaction if possible
      // to avoid needing an embedding function for metadata operations like count().
      const dummyEmbeddingFn: IEmbeddingFunction = {
        // Provide a minimal implementation or leave empty if generate is not called by getRagCollection for count()
        generate: async (texts: string[]) => {
          return texts.map(() => []); // Return empty arrays of the correct type
        },
      };
      const collection = await getRagCollection(
        dummyEmbeddingFn,
        options.workspaceRoot,
        chromaDbPath,
      ); // Use options.workspaceRoot

      const count = await collection.count();
      const contentText = `Index contains ${count} items in collection "${collection.name}".`;
      const contentPart: McpContentPart = { type: 'text', text: contentText };

      return {
        success: true,
        content: [contentPart], // Must include content array
        count: count,
        collectionName: collection.name,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Return a structured error output consistent with BaseMcpToolOutput
      const errorContent: McpContentPart = {
        type: 'text',
        text: `Failed to get index status: ${errorMsg}`,
      };
      return {
        success: false,
        content: [errorContent],
        error: errorMsg,
        count: -1, // Indicate error state
        collectionName: '', // Indicate error state
      };
    }
  },
};
