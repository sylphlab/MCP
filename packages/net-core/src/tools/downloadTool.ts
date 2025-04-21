import type * as http from 'node:http'; // Import type only for placeholder
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  BaseMcpToolOutput, // BaseMcpToolOutput might not be needed directly
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  validateAndResolvePath,
} from '@sylphlab/mcp-core';
import { downloadToolInputSchema } from './downloadTool.schema.js'; // Added .js
import type {
  DownloadInputItem,
  DownloadResultItem,
  DownloadToolInput,
  DownloadToolOutput,
} from './downloadTool.types'; // Import new types

import * as fs from 'node:fs'; // For createWriteStream
import * as fsp from 'node:fs/promises'; // For access, mkdir, unlink
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http'; // Import necessary types
import * as https from 'node:https';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';

// --- Helper Function for Single Download ---

async function processSingleDownload(
  item: DownloadInputItem,
  options: McpToolExecuteOptions,
): Promise<DownloadResultItem> {
  // Use options object
  const { id, url, destinationPath, overwrite } = item;
  const { workspaceRoot, allowOutsideWorkspace } = options; // Extract from options

  let absoluteDestPath: string | undefined; // Define here for use in catch block
  try {
    // 1. Validate and Resolve destinationPath using the core utility
    const validationResult = validateAndResolvePath(
      destinationPath,
      workspaceRoot,
      allowOutsideWorkspace,
    ); // Use extracted values
    if (typeof validationResult !== 'string') {
      // Validation failed, result is an error object
      const error = validationResult?.error ?? 'Unknown path validation error';
      const suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
      // Throw error to be caught by the main catch block below
      throw new Error(`Path validation failed: ${error} ${suggestion}`);
    }
    absoluteDestPath = validationResult; // Path is validated and absolute

    // Ensure target directory exists
    const destDir = path.dirname(absoluteDestPath);
    await fsp.mkdir(destDir, { recursive: true });

    // 2. Check file existence and overwrite flag
    try {
      await fsp.access(absoluteDestPath); // Check if file exists (throws if not)
      if (!overwrite) {
        throw new Error(
          `File already exists at '${destinationPath}'. Use overwrite: true to replace.`,
        );
      }
    } catch (error: unknown) {
      // Check if error is an object with a code property
      const isEnoent =
        error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
      // If the error is NOT ENOENT, re-throw it (this includes the "File already exists" error)
      if (!isEnoent) {
        throw error;
      }
      // Otherwise (if it IS ENOENT), do nothing and proceed, as the file not existing is acceptable here.
    }

    // 3. Fetch and Stream (with basic redirect handling)
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      // Use imported IncomingMessage
      let redirectCount = 0;
      const maxRedirects = 5; // Limit redirects

      const makeRequest = (currentUrl: string) => {
        const request = https.get(currentUrl, (res) => {
          const statusCode = res.statusCode ?? 0;

          // Handle redirects
          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            redirectCount++;
            if (redirectCount > maxRedirects) {
              reject(new Error('Exceeded maximum redirects (5).'));
              res.resume();
              return;
            }
            res.resume(); // Consume data from redirect response
            // Make new request to the redirected URL
            makeRequest(res.headers.location);
            return;
          }

          // Handle client/server errors
          if (statusCode < 200 || statusCode >= 300) {
            let errorBody = '';
            res.on('data', (chunk) => {
              if (errorBody.length < 500) {
                // Limit error body size
                errorBody += chunk.toString();
              }
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

          // Success
          resolve(res);
        });

        request.on('error', (err) => {
          // Reject with an error that includes the prefix
          reject(new Error(`Network request failed: ${err.message}`));
        });

        // Add a timeout (e.g., 30 seconds)
        request.setTimeout(30000, () => {
          request.destroy(new Error('Request timed out after 30 seconds'));
        });

        request.end();
      };
      makeRequest(url); // Initial request
    });

    // 4. Pipe to file
    const fileStream = fs.createWriteStream(absoluteDestPath);
    // Wrap pipeline in try/catch to add prefix if it throws
    try {
      await pipeline(response, fileStream);
    } catch (pipeError: unknown) {
      throw new Error(
        `File write failed: ${pipeError instanceof Error ? pipeError.message : String(pipeError)}`,
      ); // Add prefix for pipeline errors
    }

    // 5. Report success
    const successMsg = `Successfully downloaded '${url}' to '${destinationPath}'.`;
    return { id, path: destinationPath, success: true, message: successMsg };
  } catch (error: unknown) {
    // Error message already includes prefix from validation, promise rejection, or pipeline catch
    const errorMsg = `Download failed for item ${id ?? 'N/A'} (${destinationPath}): ${error instanceof Error ? error.message : String(error)}`;
    // Attempt to clean up partially written file on error
    if (absoluteDestPath) {
      // Check if path was resolved before error
      try {
        await fsp.unlink(absoluteDestPath);
      } catch (cleanupError: unknown) {
        // Log cleanup error but don't overwrite original error
        // Check if cleanupError is an object with a code property before accessing it
        if (
          cleanupError &&
          typeof cleanupError === 'object' &&
          'code' in cleanupError &&
          cleanupError.code !== 'ENOENT'
        ) {
          // Don't log if file didn't exist anyway
        }
      }
    }
    // Determine suggestion based on error type if possible (optional enhancement)
    let suggestion: string | undefined;
    // Check if error is an Error instance before accessing message
    if (error instanceof Error) {
      // Use error.message directly as prefixes are added before this catch block now
      if (
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('Network request failed')
      ) {
        suggestion = 'Check the URL and network connectivity.';
      } else if (error.message?.includes('EACCES')) {
        suggestion = 'Check file system write permissions.';
      } else if (error.message?.includes('File already exists')) {
        suggestion = 'Set overwrite: true if you want to replace the existing file.';
      } else if (error.message?.includes('Path validation failed')) {
        // Suggestion is already included in the error message from validation
        suggestion = error.message.split('Path validation failed: ')[1];
      } else if (error.message?.includes('File write failed')) {
        suggestion = 'Check disk space and file system permissions.';
      }
    }

    return {
      id,
      path: destinationPath,
      success: false,
      error: errorMsg,
      message: errorMsg,
      suggestion,
    };
  }
}

// --- Tool Definition using defineTool ---

export const downloadTool = defineTool({
  name: 'downloadTool',
  description: 'Downloads one or more files from URLs to specified paths within the workspace.',
  inputSchema: downloadToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: DownloadToolInput,
    options: McpToolExecuteOptions, // Options are received here
  ): Promise<DownloadToolOutput> => { // Still returns the specific output type

    // Input validation is handled by registerTools/SDK
    // Add upfront check for workspaceRoot within options (still useful)
    if (!options?.workspaceRoot) {
      // Return error structure instead of throwing
      const errorMsg = 'Workspace root is not available in options.';
      return {
        success: false,
        error: errorMsg,
        results: [], // Ensure results is an empty array on validation failure
        content: [{ type: 'text', text: errorMsg }],
      };
    }

    const { items } = input;
    const results: DownloadResultItem[] = [];
    let overallSuccess = false; // Track if at least one download succeeds

    // Removed the outermost try/catch block; defineTool handles unexpected errors

    for (const item of items) {
      // processSingleDownload handles its own errors for individual downloads
      const result = await processSingleDownload(item, options);
      results.push(result);
      if (result.success) {
        overallSuccess = true; // Mark overall success if any item succeeds
      }
      // Note: We don't mark overallSuccess = false here if one fails, partial success is allowed
    }

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Processed ${items.length} download requests. Overall success (at least one): ${overallSuccess}`,
        results: results,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess, // Success is true if at least one download succeeded
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
export type { DownloadToolInput, DownloadToolOutput, DownloadResultItem, DownloadInputItem };
