// import type { BaseMcpToolOutput } from '@sylphlab/tools-core'; // Removed
import type { z } from 'zod';
import type { DownloadItemSchema, downloadToolInputSchema } from './downloadTool.schema'; // Fixed import name

// --- TypeScript Types ---
export type DownloadInputItem = z.infer<typeof DownloadItemSchema>; // Fixed schema name
export type DownloadToolInput = z.infer<typeof downloadToolInputSchema>;

// Interface for a single download result item
export interface DownloadResultItem {
  id?: string; // Corresponds to input id if provided
  path: string; // The destination path provided in the input
  fullPath?: string; // The resolved absolute destination path
  success: boolean;
  message?: string; // e.g., "Successfully downloaded", "File already exists", etc.
  error?: string;
  suggestion?: string;
}
