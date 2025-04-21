import { type McpTool, BaseMcpToolOutput, type McpToolExecuteOptions, validateAndResolvePath } from '@sylphlab/mcp-core';
import type * as http from 'node:http'; // Import type only for placeholder
import type { DownloadToolInput, DownloadInputItem, DownloadResultItem, DownloadToolOutput } from './downloadTool.types'; // Import new types
import { downloadToolInputSchema } from './downloadTool.schema.js'; // Added .js

import * as fs from 'node:fs'; // For createWriteStream
import * as fsp from 'node:fs/promises'; // For access, mkdir, unlink
import * as path from 'node:path';
import * as https from 'node:https';
import { pipeline } from 'node:stream/promises';
import type { ClientRequest, RequestOptions, IncomingMessage } from 'node:http'; // Import necessary types


// --- Helper Function for Single Download ---

async function processSingleDownload(item: DownloadInputItem, options: McpToolExecuteOptions): Promise<DownloadResultItem> { // Use options object
  const { id, url, destinationPath, overwrite } = item;
  const { workspaceRoot, allowOutsideWorkspace } = options; // Extract from options
  console.log(`Processing item ${id ?? 'N/A'}: Download ${url} to ${destinationPath}`);

  let absoluteDestPath: string | undefined; // Define here for use in catch block
  try {
    // 1. Validate and Resolve destinationPath using the core utility
    const validationResult = validateAndResolvePath(destinationPath, workspaceRoot, allowOutsideWorkspace); // Use extracted values
    if (typeof validationResult !== 'string') {
      // Validation failed, result is an error object
      const error = (validationResult as any)?.error ?? 'Unknown path validation error';
      const suggestion = (validationResult as any)?.suggestion ?? 'Review path and workspace settings.';
      console.error(`Path validation failed for ${destinationPath}: ${error}.`);
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
        throw new Error(`File already exists at '${destinationPath}'. Use overwrite: true to replace.`);
      }
      console.log(`Overwriting existing file at ${destinationPath}.`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error; // Rethrow unexpected errors (e.g., permissions)
      }
      // File does not exist, which is fine, proceed.
    }

    // 3. Fetch and Stream (with basic redirect handling)
    const response = await new Promise<IncomingMessage>((resolve, reject) => { // Use imported IncomingMessage
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
            console.log(`Redirected to ${res.headers.location} (${redirectCount}/${maxRedirects})`);
            res.resume(); // Consume data from redirect response
            // Make new request to the redirected URL
            makeRequest(res.headers.location);
            return;
          }

          // Handle client/server errors
          if (statusCode < 200 || statusCode >= 300) {
            let errorBody = '';
            res.on('data', chunk => {
              if (errorBody.length < 500) { // Limit error body size
                 errorBody += chunk.toString();
              }
            });
            res.on('end', () => {
               reject(new Error(`Download failed. Status Code: ${statusCode}. ${errorBody.substring(0,100)}`));
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
    } catch (pipeError: any) {
        throw new Error(`File write failed: ${pipeError.message}`); // Add prefix for pipeline errors
    }


    // 5. Report success
    const successMsg = `Successfully downloaded '${url}' to '${destinationPath}'.`;
    console.log(successMsg);
    return { id, path: destinationPath, success: true, message: successMsg };

  } catch (error: any) {
    // Error message already includes prefix from validation, promise rejection, or pipeline catch
    const errorMsg = `Download failed for item ${id ?? 'N/A'} (${destinationPath}): ${error.message}`;
    console.error(errorMsg);
    // Attempt to clean up partially written file on error
    if (absoluteDestPath) { // Check if path was resolved before error
        try {
           console.log(`Attempting to clean up partially written file: ${absoluteDestPath}`);
           await fsp.unlink(absoluteDestPath);
           console.log(`Cleaned up: ${absoluteDestPath}`);
        } catch (cleanupError: any) {
           // Log cleanup error but don't overwrite original error
           if (cleanupError.code !== 'ENOENT') { // Don't log if file didn't exist anyway
              console.error(`Failed to clean up partial file '${absoluteDestPath}': ${cleanupError.message}`);
           }
        }
    }
    // Determine suggestion based on error type if possible (optional enhancement)
    let suggestion: string | undefined;
    // Use error.message directly as prefixes are added before this catch block now
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED') || error.message?.includes('Network request failed')) {
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


    return { id, path: destinationPath, success: false, error: errorMsg, message: errorMsg, suggestion };
  }
}


// --- Tool Definition ---

export const downloadTool: McpTool<typeof downloadToolInputSchema, DownloadToolOutput> = {
  name: 'downloadTool',
  description: 'Downloads one or more files from URLs to specified paths within the workspace.',
  inputSchema: downloadToolInputSchema,
  async execute(input: DownloadToolInput, options: McpToolExecuteOptions): Promise<DownloadToolOutput> { // Use options object
    // Add upfront check for workspaceRoot within options
    if (!options?.workspaceRoot) { // Check options.workspaceRoot
        const errorMsg = 'Workspace root is not available in options.';
        console.error(errorMsg);
        return { success: false, error: errorMsg, results: [], content: [{ type: 'text', text: errorMsg }] };
    }

    const { items } = input;
    const results: DownloadResultItem[] = [];
    let overallSuccess = false; // Track if at least one download succeeds

    console.log(`Attempting to download ${items.length} item(s)...`);

    for (const item of items) {
      // Pass the whole options object to helper
      const result = await processSingleDownload(item, options);
      results.push(result);
      if (result.success) {
        overallSuccess = true; // Mark overall success if any item succeeds
      }
    }

    console.log(`Finished processing ${items.length} download item(s). Overall success: ${overallSuccess}`);

    const contentText = JSON.stringify({
        summary: `Processed ${items.length} download requests. Overall success: ${overallSuccess}`,
        results: results
    }, null, 2); // Pretty-print JSON

    return {
      success: overallSuccess, // Overall success depends on at least one item succeeding
      results: results,
      content: [{ type: 'text', text: contentText }],
      // Remove top-level error/message if individual results handle it
    };
  },
};