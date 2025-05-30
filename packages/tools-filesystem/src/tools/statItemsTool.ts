import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/tools-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import { statItemsToolInputSchema } from './statItemsTool.schema.js';

export type StatItemsToolInput = z.infer<typeof statItemsToolInputSchema>;

export interface StatItemResult {
  path: string;
  success: boolean;
  stat?: Stats;
  error?: string;
  suggestion?: string;
}

// Zod Schema for the individual stat result (used in outputSchema)
const StatItemResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  stat: z.custom<Stats>().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant
const StatItemsOutputSchema = z.array(StatItemResultSchema);

import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

export const statItemsTool = defineTool({
  name: 'stat-items',
  description: 'Gets file system stats for one or more specified paths within the workspace.',
  inputSchema: statItemsToolInputSchema,
  contextSchema: BaseContextSchema, // Add context schema

  execute: async (
    // Use new signature with destructuring
    { context, args }: { context: ToolExecuteOptions; args: StatItemsToolInput }
  ): Promise<Part[]> => {
    // Zod validation (throw error on failure)
    const parsed = statItemsToolInputSchema.safeParse(args); // Validate args
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { paths: inputPaths } = parsed.data; // Get data from parsed args

    const results: StatItemResult[] = [];

    for (const itemPath of inputPaths) {
      let itemSuccess = false;
      let itemStat: Stats | undefined = undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let resolvedPath: string | undefined;

      // --- Validate Path ---
      // Use context for workspaceRoot and allowOutsideWorkspace
      const validationResult = validateAndResolvePath(
        itemPath,
        context.workspaceRoot,
        context?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = validationResult?.error ?? 'Unknown path validation error';
        suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
        results.push({ path: itemPath, success: false, error, suggestion });
        continue; // Skip this path
      }
      resolvedPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual stat errors
      try {
        itemStat = await stat(resolvedPath);
        itemSuccess = true;
      } catch (e: unknown) {
        itemSuccess = false;
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
        path: itemPath,
        success: itemSuccess,
        stat: itemSuccess ? itemStat : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End loop

    // Return the parts array directly
    return [jsonPart(results, StatItemsOutputSchema)];
  },
});
