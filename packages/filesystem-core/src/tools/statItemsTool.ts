import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
  validateAndResolvePath,
} from '@sylphlab/mcp-core';
import type { z } from 'zod';
import { statItemsToolInputSchema } from './statItemsTool.schema.js'; // Import schema (added .js)

export type StatItemsToolInput = z.infer<typeof statItemsToolInputSchema>;

export interface StatItemResult {
  path: string;
  success: boolean;
  stat?: Stats;
  error?: string;
  suggestion?: string;
}

export interface StatItemsToolOutput extends BaseMcpToolOutput {
  error?: string;
  results: StatItemResult[];
}

export const statItemsTool = defineTool({
  name: 'statItemsTool',
  description: 'Gets file system stats for one or more specified paths within the workspace.',
  inputSchema: statItemsToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: StatItemsToolInput,
    options: McpToolExecuteOptions,
  ): Promise<StatItemsToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = statItemsToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { paths: inputPaths } = parsed.data;

    const results: StatItemResult[] = [];
    let anySuccess = false; // True if at least one path is stat'd successfully

    for (const itemPath of inputPaths) {
      let itemSuccess = false;
      let itemStat: Stats | undefined = undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let resolvedPath: string | undefined;

      // --- Validate Path ---
      const validationResult = validateAndResolvePath(
        itemPath, options.workspaceRoot, options?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = validationResult?.error ?? 'Unknown path validation error';
        suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
        results.push({ path: itemPath, success: false, error, suggestion });
        // Don't mark overallSuccess as false for path validation failure
        continue; // Skip this path
      }
      resolvedPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual stat errors
      try {
        itemStat = await stat(resolvedPath);
        itemSuccess = true;
        anySuccess = true; // Mark overall success if at least one works
      } catch (e: unknown) {
        itemSuccess = false;
        // Don't mark overallSuccess as false for individual stat failure
        let errorCode: string | null = null;
        let errorMsg = 'Unknown error';

        if (e && typeof e === 'object') {
          if ('code' in e) errorCode = String((e as { code: unknown }).code);
        }
        if (e instanceof Error) errorMsg = e.message;

        if (errorCode === 'ENOENT') {
          error = `Path '${itemPath}' not found.`;
          suggestion = `Ensure the path '${itemPath}' exists.`;
        } else {
          error = `Failed to get stats for '${itemPath}': ${errorMsg}`;
          if (errorCode === 'EACCES') {
            suggestion = `Check permissions for the path '${itemPath}'.`;
          } else {
            suggestion = 'Check the path and permissions.';
          }
        }
      }

      // Push result for this path
      results.push({
        path: itemPath, success: itemSuccess, stat: itemStat, error, suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Stat operation completed. Overall success (at least one): ${anySuccess}`,
        results: results,
      },
      (_key, value) => { // Prefix unused 'key' with underscore
        // Custom replacer to handle BigInt in Stats object if present
        if (typeof value === 'bigint') {
          return value.toString(); // Convert BigInt to string
        }
        return value;
      },
      2, // Pretty-print JSON
    );

    // Return the specific output structure
    return {
      success: anySuccess, // Success is true if at least one stat succeeded
      results: results,
      content: [{ type: 'text', text: contentText }],
    };
  },
});

// Ensure necessary types are still exported
// export type { StatItemsToolInput, StatItemsToolOutput, StatItemResult }; // Removed duplicate export
