import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/mcp-core';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import { downloadToolInputSchema } from './downloadTool.schema.js';
import type {
  DownloadInputItem,
  // DownloadResultItem is defined below
  DownloadToolInput,
  // DownloadToolOutput is inferred from schema
} from './downloadTool.types';

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';

// --- Output Types ---
export interface DownloadResultItem {
  /** Optional ID from the input item. */
  id?: string;
  /** The destination path provided in the input. */
  path: string;
  /** Whether the download operation for this item was successful. */
  success: boolean;
  /** Optional message providing more details (e.g., success message). */
  message?: string;
  /** Optional error message if the operation failed for this item. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const DownloadResultItemSchema = z.object({
  id: z.string().optional(),
  path: z.string(),
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
  options: McpToolExecuteOptions,
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
      const error = validationResult?.error ?? 'Unknown path validation error';
      const suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
      throw new Error(`Path validation failed: ${error} ${suggestion}`);
    }
    absoluteDestPath = validationResult;

    // Ensure target directory exists
    const destDir = path.dirname(absoluteDestPath);
    await fsp.mkdir(destDir, { recursive: true });

    // 2. Check file existence and overwrite flag
    try {
      await fsp.access(absoluteDestPath);
      if (!overwrite) {
        throw new Error(
          `File already exists at '${destinationPath}'. Use overwrite: true to replace.`,
        );
      }
      // If overwrite is true, attempt to delete existing file before download
      await fsp.unlink(absoluteDestPath);
    } catch (error: unknown) {
      const isEnoent =
        error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
      if (!isEnoent) {
        // Re-throw if it's not a 'file not found' error (includes the 'File already exists' error if overwrite is false)
        throw error;
      }
      // If ENOENT, proceed (file doesn't exist or was just deleted)
    }

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
              res.resume();
              return;
            }
            res.resume();
            makeRequest(res.headers.location);
            return;
          }

          if (statusCode < 200 || statusCode >= 300) {
            let errorBody = '';
            res.on('data', (chunk) => {
              if (errorBody.length < 500) errorBody += chunk.toString();
            });
            res.on('end', () => {
              reject(
                new Error(
                  `Download failed. Status Code: ${statusCode}. ${errorBody.substring(0, 100)}`,
                ),
              );
            });
            res.resume();
            return;
          }
          resolve(res);
        });

        request.on('error', (err) => {
          reject(new Error(`Network request failed: ${err.message}`));
        });
        request.setTimeout(30000, () => {
          request.destroy(new Error('Request timed out after 30 seconds'));
        });
        request.end();
      };
      makeRequest(url);
    });

    // 4. Pipe to file
    const fileStream = fs.createWriteStream(absoluteDestPath);
    try {
      await pipeline(response, fileStream);
    } catch (pipeError: unknown) {
      throw new Error(
        `File write failed: ${pipeError instanceof Error ? pipeError.message : String(pipeError)}`,
      );
    }

    // 5. Report success
    const successMsg = `Successfully downloaded '${url}' to '${destinationPath}'.`;
    return { id, path: destinationPath, success: true, message: successMsg };
  } catch (error: unknown) {
    const errorMsg = `Download failed for item ${id ?? url}: ${error instanceof Error ? error.message : String(error)}`;

    // Attempt cleanup only if path was resolved
    if (absoluteDestPath) {
      try {
        await fsp.unlink(absoluteDestPath);
      } catch (cleanupError: unknown) {
        if (
          cleanupError &&
          typeof cleanupError === 'object' &&
          'code' in cleanupError &&
          cleanupError.code !== 'ENOENT'
        ) {
          // Log or handle cleanup error if needed, but don't obscure original error
        }
      }
    }

    let suggestion: string | undefined;
    if (error instanceof Error) {
      if (
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('Network request failed') ||
        error.message?.includes('timed out')
      ) {
        suggestion = 'Check the URL and network connectivity.';
      } else if (error.message?.includes('EACCES')) {
        suggestion = 'Check file system write permissions for the destination directory.';
      } else if (error.message?.includes('File already exists')) {
        suggestion = 'Set overwrite: true if you want to replace the existing file.';
      } else if (error.message?.includes('Path validation failed')) {
        // Extract suggestion from the validation error message itself
        suggestion =
          error.message.split('Path validation failed: ')[1]?.split('Suggestion: ')[1] ??
          'Check path validity and workspace settings.';
      } else if (error.message?.includes('File write failed')) {
        suggestion = 'Check disk space and file system permissions.';
      } else {
        suggestion = 'Review the error message and input parameters.';
      }
    }

    return {
      id,
      path: destinationPath,
      success: false,
      error: errorMsg,
      // message: errorMsg, // Keep message for success only
      suggestion,
    };
  }
}

// --- Tool Definition using defineTool ---

export const downloadTool = defineTool({
  name: 'downloadTool',
  description: 'Downloads one or more files from URLs to specified paths within the workspace.',
  inputSchema: downloadToolInputSchema,
  outputSchema: DownloadToolOutputSchema, // Use the array schema

  execute: async (input: DownloadToolInput, options: McpToolExecuteOptions): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = downloadToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }

    // Add upfront check for workspaceRoot within options
    if (!options?.workspaceRoot) {
      throw new Error('Workspace root is not available in options.');
    }

    const { items } = parsed.data;
    const results: DownloadResultItem[] = [];

    // Process downloads (could be parallelized with Promise.all for performance)
    for (const item of items) {
      const result = await processSingleDownload(item, options);
      results.push(result);
    }

    // Return the results wrapped in jsonPart
    return [jsonPart(results, DownloadToolOutputSchema)];
  },
});

// Ensure necessary types are still exported
