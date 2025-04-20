import { z } from 'zod';
import type { BaseMcpToolOutput } from '@sylphlab/mcp-core';
import { DownloadItemSchema, downloadToolInputSchema } from './downloadTool.schema';

// Type for a single download item input
export type DownloadItem = z.infer<typeof DownloadItemSchema>;

// Type for the overall tool input
export type DownloadToolInput = z.infer<typeof downloadToolInputSchema>;

// Interface for a single download result item
export interface DownloadResultItem {
  id?: string; // Correlates with input item id
  path: string; // The original requested destination path
  success: boolean;
  message?: string;
  error?: string;
  suggestion?: string;
}

// Output interface for the tool (includes multiple results)
export interface DownloadToolOutput extends BaseMcpToolOutput {
  results: DownloadResultItem[];
  error?: string; // Optional overall error if the tool itself fails unexpectedly
}