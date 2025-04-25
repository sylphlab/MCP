import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import type { IndexManager } from '../indexManager.js';
import type { RagToolExecuteOptions } from '../types.js'; // Import the shared extended options type

// --- Input Schema ---
const IndexStatusInputSchema = z.object({}).optional(); // No input needed

// --- TypeScript Type ---
export type IndexStatusInput = z.infer<typeof IndexStatusInputSchema>;

// --- Output Types ---
export interface IndexStatusResult {
  /** Whether retrieving status was successful overall (primarily DB status). */
  success: boolean;
  /** Number of chunks in the index collection. */
  chunkCount?: number;
  /** Name of the index collection. */
  collectionName?: string;
  /** Current operational state of the RAG service. */
  serviceState?: 'Initializing' | 'Scanning' | 'Processing Initial Queue' | 'Watching' | 'Idle' | 'Stopping' | 'Unknown';
  /** Whether the RAG service background process is initialized. */
  serviceInitialized?: boolean;
  /** Whether the initial scan and processing is complete. */
  initialScanComplete?: boolean;
  /** Whether the file watcher is currently active. */
  serviceWatching?: boolean;
  /** Number of files currently waiting in the processing queue. */
  filesInQueue?: number;
  /** Total number of files processed since service start (includes initial scan). */
  processedFilesCount?: number;
  /** Total number of files found during the initial scan (null if scan not complete). */
  totalFilesInitialScan?: number | null;
  /** Error message, if retrieval failed. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const IndexStatusResultSchema = z.object({
  success: z.boolean(),
  chunkCount: z.number().int().nonnegative().optional(),
  collectionName: z.string().optional(),
  serviceState: z.enum(['Initializing', 'Scanning', 'Processing Initial Queue', 'Watching', 'Idle', 'Stopping', 'Unknown']).optional(),
  serviceInitialized: z.boolean().optional(),
  initialScanComplete: z.boolean().optional(),
  serviceWatching: z.boolean().optional(),
  filesInQueue: z.number().int().nonnegative().optional(),
  processedFilesCount: z.number().int().nonnegative().optional(),
  totalFilesInitialScan: z.number().int().nonnegative().nullable().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const IndexStatusOutputSchema = z.array(IndexStatusResultSchema);

// --- Tool Definition using defineTool ---
export const indexStatusTool = defineTool({
  name: 'getIndexStatus',
  description: 'Gets the status of the RAG index (chunk count, collection name) and the background service state.',
  inputSchema: IndexStatusInputSchema,


  execute: async (
    _input: IndexStatusInput, // Input is optional/empty
    options: ToolExecuteOptions, // Keep base type for compatibility
  ): Promise<Part[]> => {
    // Zod validation
    const parsed = IndexStatusInputSchema.safeParse(_input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : ''}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }

    // Assert options type to access indexManager and potentially ragService
    // Assuming ragService instance is passed via options if available
    const ragOptions = options as RagToolExecuteOptions & { ragService?: { getServiceStatus: () => any } };

    let dbSuccess = false;
    let chunkCount: number | undefined;
    let collectionName: string | undefined;
    let dbError: string | undefined;
    let dbSuggestion: string | undefined;

    // Try to get DB status from IndexManager
    if (ragOptions.indexManager?.isInitialized()) { // Use optional chaining
        try {
            const indexDbStatus = await ragOptions.indexManager.getStatus();
            chunkCount = indexDbStatus.count;
            collectionName = indexDbStatus.name;
            dbSuccess = true; // DB status retrieval was successful
        } catch (e: unknown) {
            dbSuccess = false; // DB status retrieval failed
            dbError = e instanceof Error ? e.message : 'Unknown error getting index DB status';
            dbSuggestion = 'Check vector database configuration and connectivity.';
        }
    } else {
        dbSuccess = false;
        dbError = 'IndexManager instance is missing or not initialized in ToolExecuteOptions.';
        dbSuggestion = 'Ensure the RAG service started correctly and passed the IndexManager.';
    }

    // Get service status if available
    let serviceStatus: any = null; // Use 'any' to avoid complex type checking for now
    if (ragOptions.ragService && typeof ragOptions.ragService.getServiceStatus === 'function') {
        try {
            serviceStatus = ragOptions.ragService.getServiceStatus();
        } catch (serviceError) {
            console.error("Error calling ragService.getServiceStatus():", serviceError);
            // Don't fail the whole tool, just report service status as unknown
        }
    }

    // Combine results
    const finalResult: IndexStatusResult = {
      success: dbSuccess, // Overall success depends primarily on getting DB status
      chunkCount: chunkCount,
      collectionName: collectionName,
      error: dbError, // Report DB error if present
      suggestion: dbSuggestion,
      // Add service status fields, defaulting if serviceStatus is null/unavailable
      serviceState: serviceStatus?.state ?? 'Unknown',
      serviceInitialized: serviceStatus?.initialized ?? false,
      initialScanComplete: serviceStatus?.initialScanComplete ?? false,
      serviceWatching: serviceStatus?.watching ?? false,
      filesInQueue: serviceStatus?.filesInQueue,
      processedFilesCount: serviceStatus?.processedFilesCount,
      totalFilesInitialScan: serviceStatus?.totalFilesInitialScan,
    };

    // Return the result wrapped in jsonPart
    return [jsonPart([finalResult], IndexStatusOutputSchema)];
  },
});

// Export necessary types
