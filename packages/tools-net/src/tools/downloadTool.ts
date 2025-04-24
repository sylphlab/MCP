import { defineTool } from '@sylphlab/tools-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import { downloadToolInputSchema } from './downloadTool.schema.js';
import type {
  DownloadInputItem,
  DownloadResultItem, // Interface is in .types.ts
  DownloadToolInput,
} from './downloadTool.types.js'; // Import types from .types.ts

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';

// Zod Schema for the individual result (defined here as it uses the interface from .types.ts)
export const DownloadResultItemSchema = z.object({
  id: z.string().optional(),
  path: z.string(),
  fullPath: z.string().optional(), // Add fullPath schema
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const DownloadToolOutputSchema = z.array(DownloadResultItemSchema);


// --- Helper Function for Single Download ---

async function processSingleDownload(
  item: DownloadInputItem,
  options: ToolExecuteOptions,
): Promise<DownloadResultItem> {
  const { id, url, destinationPath, overwrite } = item;
  const { workspaceRoot, allowOutsideWorkspace } = options;

  let absoluteDestPath: string | undefined;
  try {
    // 1. Validate and Resolve destinationPath
    const validationResult = validateAndResolvePath(
      destinationPath,
      workspaceRoot,
      allowOutsideWorkspace,
    );
    if (typeof validationResult !== 'string') {
      throw new Error(`Path validation failed: ${validationResult.error} ${validationResult.suggestion ?? ''}`);
    }
    absoluteDestPath = validationResult;

    // Ensure target directory exists *before* fetch
    const destDir = path.dirname(absoluteDestPath);
    await fsp.mkdir(destDir, { recursive: true });

    // 3. Fetch and Stream (with basic redirect handling)
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      let redirectCount = 0;
      const maxRedirects = 5;

      const makeRequest = (currentUrl: string) => {
        const request = https.get(currentUrl, (res) => {
          const statusCode = res.statusCode ?? 0;

          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            redirectCount++;
            if (redirectCount > maxRedirects) {
              reject(new Error('Exceeded maximum redirects (5).'));
              res.resume(); return;
            }
            res.resume(); makeRequest(res.headers.location); return;
          }

          if (statusCode < 200 || statusCode >= 300) {
            let errorBody = '';
            res.on('data', (chunk) => { if (errorBody.length < 500) errorBody += chunk.toString(); });
            res.on('end', () => reject(new Error(`Download failed. Status Code: ${statusCode}. ${errorBody.substring(0, 100)}`)));
            res.resume(); return;
          }
          resolve(res);
        });
        request.on('error', (err) => reject(new Error(`Network request failed: ${err.message}`)));
        request.setTimeout(30000, () => request.destroy(new Error('Request timed out after 30 seconds')));
        request.end();
      };
      makeRequest(url);
    });

    // 4. Check file existence *after* successful fetch, before writing
    let fileExists = false;
    try {
      await fsp.access(absoluteDestPath);
      fileExists = true;
    } catch (accessError: unknown) {
      if (!(accessError && typeof accessError === 'object' && 'code' in accessError && accessError.code === 'ENOENT')) {
        throw accessError; // Re-throw unexpected errors
      }
      // ENOENT means file doesn't exist, proceed normally
    }

    if (fileExists) {
      if (!overwrite) {
        throw new Error(`File already exists at '${destinationPath}'. Use overwrite: true to replace.`);
      }
      await fsp.unlink(absoluteDestPath); // Delete if overwriting
    }

    // 5. Pipe to file
    const fileStream = fs.createWriteStream(absoluteDestPath);
    try {
      if (!response) throw new Error("Response object is undefined after fetch promise."); // Should not happen
      await pipeline(response, fileStream);
    } catch (pipeError: unknown) {
      try { await fsp.unlink(absoluteDestPath); } catch { /* ignore cleanup error */ } // Attempt cleanup on pipe error
      throw new Error(`File write failed: ${pipeError instanceof Error ? pipeError.message : String(pipeError)}`);
    }

    // 6. Report success
    const successMsg = `Successfully downloaded '${url}' to '${destinationPath}'.`;
    return { id, path: destinationPath, fullPath: absoluteDestPath, success: true, message: successMsg };

  } catch (error: unknown) {
     // Centralized error handling for validation, fetch, or pipeline errors
     const errorMsg = `Download failed for item ${id ?? url}: ${error instanceof Error ? error.message : String(error)}`;

     // Attempt cleanup if path was resolved and error wasn't "file exists"
     if (absoluteDestPath && !(error instanceof Error && error.message.includes('already exists'))) {
       try { await fsp.unlink(absoluteDestPath); } catch { /* ignore cleanup error */ }
     }

     // Re-throw the consolidated error message
     throw new Error(errorMsg);
  }
}


// --- Tool Definition using defineTool ---

export const downloadTool = defineTool({
  name: 'downloadTool',
  description: 'Downloads one or more files from URLs to specified paths within the workspace.',
  inputSchema: downloadToolInputSchema,

  execute: async (input: DownloadToolInput, options: ToolExecuteOptions): Promise<Part[]> => {
    const parsed = downloadToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    if (!options?.workspaceRoot) {
      throw new Error('Workspace root is not available in options.');
    }

    const { items } = parsed.data;
    const results: DownloadResultItem[] = [];

    // Process downloads sequentially, catching errors from processSingleDownload
    try {
        for (const item of items) {
          const result = await processSingleDownload(item, options);
          results.push(result);
        }
    } catch (e: unknown) {
        // If processSingleDownload throws an error, re-throw it
        // The adapter layer should handle this and format an error response.
        throw e; // Re-throw the original error
    }

    // If loop completes without error, return all results
    return [jsonPart(results, DownloadToolOutputSchema)];
  },
});
