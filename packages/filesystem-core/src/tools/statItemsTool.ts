import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import {
  type BaseMcpToolOutput,
  type McpTool,
  type McpToolExecuteOptions,
  McpToolInput,
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

export const statItemsTool: McpTool<typeof statItemsToolInputSchema, StatItemsToolOutput> = {
  name: 'statItemsTool',
  description: 'Gets file system stats for one or more specified paths within the workspace.',
  inputSchema: statItemsToolInputSchema,

  async execute(
    input: StatItemsToolInput,
    options: McpToolExecuteOptions,
  ): Promise<StatItemsToolOutput> {
    // Remove workspaceRoot, require options
    const parsed = statItemsToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      return {
        success: false,
        error: `Input validation failed: ${errorMessages}`,
        results: [],
        content: [],
      };
    }
    const { paths: inputPaths } = parsed.data;

    const results: StatItemResult[] = [];
    let anySuccess = false;

    for (const itemPath of inputPaths) {
      let itemSuccess = false;
      let itemStat: Stats | undefined = undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let resolvedPath: string | undefined;

      // Correct argument order: relativePathInput, workspaceRoot
      const validationResult = validateAndResolvePath(
        itemPath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      ); // Use options.workspaceRoot

      // Check if validation succeeded (result is a string)
      if (typeof validationResult === 'string') {
        resolvedPath = validationResult;

        try {
          itemStat = await stat(resolvedPath);
          itemSuccess = true;
          anySuccess = true;
        } catch (e: unknown) {
          itemSuccess = false;
          let errorCode: string | null = null;
          let errorMsg = 'Unknown error';

          if (e && typeof e === 'object') {
            if ('code' in e) {
              errorCode = String((e as { code: unknown }).code);
            }
          }
          if (e instanceof Error) {
            errorMsg = e.message;
          }

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
        results.push({
          path: itemPath,
          success: itemSuccess,
          stat: itemStat,
          error,
          suggestion,
        });
      } else {
        // Validation failed, result is the error object (or unexpected format)
        error = validationResult?.error ?? 'Unknown path validation error'; // Access .error
        suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
        results.push({ path: itemPath, success: false, error, suggestion });
      }
    } // End loop

    // Serialize the detailed results into the content field
    // Note: Stats objects might not serialize perfectly with JSON.stringify,
    // but it's better than losing the data entirely. Client might need specific parsing.
    const contentText = JSON.stringify(
      {
        summary: `Stat operation completed. Overall success (at least one): ${anySuccess}`,
        results: results,
      },
      null,
      2,
    ); // Pretty-print JSON

    return {
      success: anySuccess, // Keep original success logic
      results: results, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};
