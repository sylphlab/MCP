import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Stats } from 'node:fs';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, validateAndResolvePath, type McpToolExecuteOptions } from '@sylphlab/mcp-core';

export const StatItemsToolInputSchema = z.object({
  paths: z.array(
      z.string({ required_error: 'Each path must be a string' })
       .min(1, 'Path cannot be empty')
    )
    .min(1, 'paths array cannot be empty'),
});

export type StatItemsToolInput = z.infer<typeof StatItemsToolInputSchema>;

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

export const statItemsTool: McpTool<typeof StatItemsToolInputSchema, StatItemsToolOutput> = {
  name: 'statItemsTool',
  description: 'Gets file system stats for one or more specified paths within the workspace.',
  inputSchema: StatItemsToolInputSchema,

  async execute(input: StatItemsToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<StatItemsToolOutput> {
    const parsed = StatItemsToolInputSchema.safeParse(input);
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
      const validationResult = validateAndResolvePath(itemPath, workspaceRoot, options?.allowOutsideWorkspace);

      // Check if validation succeeded (result is a string)
      if (typeof validationResult === 'string') {
        resolvedPath = validationResult;

        try {
          itemStat = await stat(resolvedPath);
          itemSuccess = true;
          anySuccess = true;
        } catch (e: any) {
          itemSuccess = false;
          if (e.code === 'ENOENT') {
            error = `Path '${itemPath}' not found.`;
            suggestion = `Ensure the path '${itemPath}' exists.`;
            console.error(error);
          } else {
            error = `Failed to get stats for '${itemPath}': ${e.message}`;
            console.error(error);
            if (e.code === 'EACCES') {
              suggestion = `Check permissions for the path '${itemPath}'.`;
            } else {
              suggestion = `Check the path and permissions.`;
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
        error = (validationResult as any)?.error ?? 'Unknown path validation error'; // Access .error
        suggestion = (validationResult as any)?.suggestion ?? 'Review path and workspace settings.';
        console.error(`Path validation failed for ${itemPath}: ${error}. Raw validationResult:`, validationResult);
        results.push({ path: itemPath, success: false, error, suggestion });
      }
    } // End loop

    // Serialize the detailed results into the content field
    // Note: Stats objects might not serialize perfectly with JSON.stringify,
    // but it's better than losing the data entirely. Client might need specific parsing.
    const contentText = JSON.stringify({
        summary: `Stat operation completed. Overall success (at least one): ${anySuccess}`,
        results: results
    }, null, 2); // Pretty-print JSON

    return {
      success: anySuccess, // Keep original success logic
      results: results, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};