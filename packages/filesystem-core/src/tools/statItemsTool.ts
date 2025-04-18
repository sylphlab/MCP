import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Stats } from 'node:fs'; // Import Stats type
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput } from '@sylphlab/mcp-core'; // Import base types

// --- Zod Schema for Input Validation ---
const StatItemsToolInputSchema = z.object({
  paths: z.array(
      z.string({ required_error: 'Each path must be a string' })
       .min(1, 'Path cannot be empty')
    )
    .min(1, 'paths array cannot be empty'),
});

// Infer the TypeScript type from the Zod schema
export type StatItemsToolInput = z.infer<typeof StatItemsToolInputSchema>;

// --- Output Types ---
export interface StatItemResult {
  /** The path provided in the input. */
  path: string;
  /** Whether the stat operation for this specific path was successful. */
  success: boolean;
  /** The file system stats object. Undefined if the operation failed or path doesn't exist. */
  stat?: Stats;
  /** Optional error message if the operation failed for this path. */
  error?: string;
}

// Extend the base output type
export interface StatItemsToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true if stats were retrieved for at least one path). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each stat operation. */
  results: StatItemResult[];
}

// --- Tool Definition (following SDK pattern) ---

export const statItemsTool: McpTool<typeof StatItemsToolInputSchema, StatItemsToolOutput> = {
  name: 'statItemsTool',
  description: 'Gets file system stats for one or more specified paths within the workspace.',
  inputSchema: StatItemsToolInputSchema,

  async execute(input: StatItemsToolInput, workspaceRoot: string): Promise<StatItemsToolOutput> {
    // Zod validation
    const parsed = StatItemsToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      return {
        success: false,
        error: `Input validation failed: ${errorMessages}`,
        results: [],
        content: [], // Add required content field
      };
    }
    const { paths: inputPaths } = parsed.data;
    // --- End Zod Validation ---

    const results: StatItemResult[] = [];
    let anySuccess = false;

    for (const itemPath of inputPaths) {
      const fullPath = path.resolve(workspaceRoot, itemPath);
      let itemSuccess = false;
      let itemStat: Stats | undefined = undefined;
      let error: string | undefined;

      // --- Security Check ---
      const relativePath = path.relative(workspaceRoot, fullPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          error = `Path validation failed: Path must resolve within the workspace root ('${workspaceRoot}'). Relative Path: '${relativePath}'`;
          console.error(`Skipping stat for ${itemPath}: ${error}`);
      } else {
        try {
            // Get stats
            itemStat = await stat(fullPath);
            itemSuccess = true;
            anySuccess = true; // Mark overall success if at least one works

        } catch (e: any) {
            itemSuccess = false;
            // Report ENOENT (Not Found) as a non-error state for stat, but itemSuccess is false
            if (e.code === 'ENOENT') {
                 error = `Path '${itemPath}' not found.`;
                 console.log(error); // Log as info, not error
            } else {
                 // Report other errors as failures
                 error = `Failed to get stats for '${itemPath}': ${e.message}`;
                 console.error(error);
            }
        }
      }

      results.push({
        path: itemPath,
        success: itemSuccess,
        stat: itemStat, // Will be undefined if error occurred or not found
        error,
      });
    }

    return {
      success: anySuccess, // True if at least one stat succeeded
      results,
      content: [], // Add required content field
    };
  },
};