import { mkdir } from 'node:fs/promises';
import { defineTool } from '@sylphlab/tools-core'; // Import the helper
import {
  // Import values normally
  jsonPart, // Import helper value
  validateAndResolvePath,
} from '@sylphlab/tools-core';
import type {
  // Import types separately
  ToolExecuteOptions,
  Part,
} from '@sylphlab/tools-core'; // Import base types and validation util
import { z } from 'zod'; // Import z directly
// import type { z } from 'zod'; // z imported above
import { createFolderToolInputSchema } from './createFolderTool.schema.js'; // Import schema (added .js)

// Infer the TypeScript type from the Zod schema
export type CreateFolderToolInput = z.infer<typeof createFolderToolInputSchema>;

// --- Output Types ---
export interface CreateFolderResult {
  path: string;
  success: boolean;
  message?: string;
  error?: string;
  suggestion?: string;
}

// Zod Schema for the individual folder creation result (used in outputSchema)
const CreateFolderResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Extend the base output type
// Removed CreateFolderToolOutput - execute now returns InternalToolExecutionResult

// Define the output schema instance as a constant
const CreateFolderOutputSchema = z.array(CreateFolderResultSchema);

// --- Tool Definition using defineTool ---
import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

export const createFolderTool = defineTool({
  name: 'create-folder',
  description: 'Creates one or more new folders at the specified paths within the workspace.',
  inputSchema: createFolderToolInputSchema,
  contextSchema: BaseContextSchema, // Add context schema
   // Use the constant schema instance

  execute: async (
    // Use new signature with destructuring
    { context, args }: { context: ToolExecuteOptions; args: CreateFolderToolInput }
  ): Promise<Part[]> => {
    // Return Part[] directly

    // Zod validation (throw error on failure)
    const parsed = createFolderToolInputSchema.safeParse(args); // Validate args
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { folderPaths } = parsed.data; // Get data from parsed args

    const results: CreateFolderResult[] = [];
    // let anySuccess = false; // Removed unused variable

    for (const folderPath of folderPaths) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let fullPath: string;

      // --- Validate and Resolve Path ---
      // Use context for workspaceRoot and allowOutsideWorkspace
      const validationResult = validateAndResolvePath(
        folderPath,
        context.workspaceRoot,
        context?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = validationResult.error;
        suggestion = validationResult.suggestion;
        results.push({ path: folderPath, success: false, error, suggestion });
        continue; // Skip to next folderPath
      }
      fullPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual folder creation errors
      try {
        await mkdir(fullPath, { recursive: true });
        itemSuccess = true;
        // anySuccess = true; // Removed unused variable
        message = `Folder created successfully at '${folderPath}'.`;
      } catch (e: unknown) {
        itemSuccess = false;
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        error = `Failed to create folder '${folderPath}': ${errorMsg}`;
        suggestion = `Check permissions for the directory containing '${folderPath}' and ensure the path name is valid.`;
        // Note: We don't set overallSuccess to false here, partial success is possible.
      }

      // Push result for this path
      results.push({
        path: folderPath,
        success: itemSuccess,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End for loop

    return [jsonPart(results, CreateFolderOutputSchema)]; // Return the parts array directly
  },
});
