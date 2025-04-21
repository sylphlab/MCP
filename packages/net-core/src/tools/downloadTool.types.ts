import type { BaseMcpToolOutput } from '@sylphlab/mcp-core';
import type { z } from 'zod';
import type { DownloadItemSchema, downloadToolInputSchema } from './downloadTool.schema'; // Fixed import name

// --- TypeScript Types ---
export type DownloadInputItem = z.infer<typeof DownloadItemSchema>; // Fixed schema name
export type DownloadToolInput = z.infer<typeof downloadToolInputSchema>;

// Interface for a single download result item
export interface DownloadResultItem {
  id?: string; // Corresponds to input id if provided
  path: string; // The destination path provided in the input
  success: boolean;
  message?: string; // e.g., "Successfully downloaded", "File already exists", etc.
  error?: string;
  suggestion?: string;
}

// Output interface for the tool (includes multiple results)
export interface DownloadToolOutput extends BaseMcpToolOutput {
  results: DownloadResultItem[];
  error?: string; // Optional overall error if the tool itself fails unexpectedly
}
