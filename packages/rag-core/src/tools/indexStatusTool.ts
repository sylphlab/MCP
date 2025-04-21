import path from 'node:path'; // Import path
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
// Correct imports based on core/src/index.ts
import type {
  BaseMcpToolOutput,
  McpContentPart,
  McpTool, // McpTool might not be needed directly
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

// Implement the tool using defineTool
export const indexStatusTool = defineTool({
  name: 'getIndexStatus',
  description: 'Gets the status of the RAG index (e.g., number of items).',
  inputSchema: IndexStatusInput, // Use Zod schema directly

  execute: async ( // Core logic passed to defineTool
    _input: z.infer<typeof IndexStatusInput>, // Input is optional/empty
    options: McpToolExecuteOptions, // Options are received here
  ): Promise<IndexStatusOutput> => { // Still returns the specific output type

    // Removed try/catch, defineTool wrapper handles errors

    // Determine chromaDbPath using options.workspaceRoot
    const chromaDbPath = path.join(options.workspaceRoot, '.mcp', 'chroma_db');

    // Create a minimal dummy embedding function locally
    // TODO: Refactor getRagCollection to not require embeddingFn for count()
    const dummyEmbeddingFn: IEmbeddingFunction = {
      generate: async (texts: string[]) => texts.map(() => []),
    };

    // Get collection and count (errors here will be caught by defineTool)
    const collection = await getRagCollection(
      dummyEmbeddingFn,
      options.workspaceRoot,
      chromaDbPath,
    );
    const count = await collection.count();

    // Construct success output
    const contentText = `Index contains ${count} items in collection "${collection.name}".`;
    const contentPart: McpContentPart = { type: 'text', text: contentText };

    return {
      success: true,
      content: [contentPart], // Must include content array
      count: count,
      collectionName: collection.name,
    };
  },
});

// Ensure necessary types are still exported
export type { IndexStatusInput, IndexStatusOutput };
