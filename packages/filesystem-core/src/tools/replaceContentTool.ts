import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import glob from 'fast-glob'; // Import fast-glob
import { McpTool, BaseMcpToolOutput, McpToolInput, validateAndResolvePath, PathValidationError, McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import base types and validation util

// --- Zod Schema for Input Validation ---
const ReplaceOperationSchema = z.object({
    search: z.string().min(1, 'search pattern cannot be empty'),
    replace: z.string(),
    isRegex: z.boolean().optional().default(false),
    flags: z.string().optional(), // e.g., 'g', 'i', 'm', 'gi'
}).refine(data => !data.isRegex || data.flags === undefined || /^[gimyus]+$/.test(data.flags), {
    message: "Invalid regex flags provided. Only 'g', 'i', 'm', 'y', 'u', 's' are allowed.",
    path: ['flags'],
});

export const ReplaceContentToolInputSchema = z.object({
  paths: z.array(
      z.string({ required_error: 'Each path/glob must be a string' })
       .min(1, 'Path/glob cannot be empty')
    )
    .min(1, 'paths array cannot be empty'),
  operations: z.array(ReplaceOperationSchema).min(1, 'operations array cannot be empty'),
  // allowOutsideWorkspace removed from schema
});

// Infer the TypeScript type from the Zod schema
export type ReplaceContentToolInput = z.infer<typeof ReplaceContentToolInputSchema>;
export type ReplaceOperation = z.infer<typeof ReplaceOperationSchema>;

// --- Output Types ---
export interface FileReplaceResult {
  /** The file path processed (relative to workspace root). */
  path: string;
  /** Whether the replacement operations for this specific file were successful. */
  success: boolean;
  /** Number of replacements made in this file across all operations. */
  replacementsMade: number;
   /** True if the file content was actually changed and written back. */
  contentChanged: boolean;
  /** Optional error message if processing failed for this file. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Extend the base output type
export interface ReplaceContentToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true only if ALL matched files processed successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each file processed. */
  results: FileReplaceResult[];
}

// --- Tool Definition (following SDK pattern) ---

export const replaceContentTool: McpTool<typeof ReplaceContentToolInputSchema, ReplaceContentToolOutput> = {
  name: 'replaceContentTool',
  description: 'Performs search and replace operations across multiple files (supports globs).',
  inputSchema: ReplaceContentToolInputSchema,

  async execute(input: ReplaceContentToolInput, options: McpToolExecuteOptions): Promise<ReplaceContentToolOutput> { // Remove workspaceRoot, require options
    // Zod validation
    const parsed = ReplaceContentToolInputSchema.safeParse(input);
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
    const { paths: pathPatterns, operations } = parsed.data; // allowOutsideWorkspace comes from options
    // --- End Zod Validation ---

    const fileResults: FileReplaceResult[] = [];
    let overallSuccess = true;
    let resolvedFilePaths: string[] = [];

    try {
        // Expand globs, ensuring paths are relative to workspaceRoot for security
        resolvedFilePaths = await glob(pathPatterns, {
            cwd: options.workspaceRoot, // Use options.workspaceRoot
            absolute: false, // Keep paths relative to cwd
            onlyFiles: true, // Only operate on files
            dot: true, // Include dotfiles
            ignore: ['**/node_modules/**', '**/.git/**'], // Sensible defaults
        });

        if (resolvedFilePaths.length === 0) {
             console.error('No files matched the provided paths/globs.'); // Log to stderr
             // Return success=true but empty results if no files match
             return { success: true, results: [], content: [] }; // Add content
        }

    } catch (globError: any) {
        console.error(`Error expanding glob patterns: ${globError.message}`);
        return { success: false, error: `Glob pattern error: ${globError.message}`, results: [], content: [] }; // Add content
    }


    for (const relativeFilePath of resolvedFilePaths) {
        const fullPath = path.resolve(options.workspaceRoot, relativeFilePath); // Use options.workspaceRoot
        let fileSuccess = true;
        let fileError: string | undefined;
        let totalReplacementsMade = 0;
        let contentChanged = false;
        let suggestion: string | undefined;


        // Double-check security (glob should handle this, but belt-and-suspenders)
        // Skip this check if allowOutsideWorkspace is true
        const relativeCheck = path.relative(options.workspaceRoot, fullPath); // Use options.workspaceRoot
        if (!options?.allowOutsideWorkspace && (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck))) {
            fileError = `Path validation failed: Matched file '${relativeFilePath}' is outside workspace root.`;
            console.error(fileError);
            fileSuccess = false;
            overallSuccess = false;
            const suggestion = `Ensure the path pattern '${pathPatterns.join(', ')}' does not resolve to paths outside the workspace.`;
            fileResults.push({ path: relativeFilePath, success: false, replacementsMade: 0, contentChanged: false, error: fileError, suggestion });
            continue; // Skip this file
        }

        try {
            const originalContent = await readFile(fullPath, 'utf-8');
            let currentContent = originalContent;

            for (const op of operations) {
                let operationReplacements = 0;
                let tempContent = '';
                if (op.isRegex) {
                    try {
                        const regex = new RegExp(op.search, op.flags ?? '');
                        tempContent = currentContent.replace(regex, op.replace);
                        // Note: Counting regex replacements accurately can be tricky without global flag + matchAll
                        // This simple check assumes at least one replacement if content changed.
                        if (tempContent !== currentContent) {
                            operationReplacements = 1; // Simplistic count for now
                        }
                    } catch (e: any) {
                        throw new Error(`Invalid regex '${op.search}': ${e.message}`);
                    }
                } else {
                    // Simple text replacement
                    const searchString = op.search;
                    // Count occurrences before replacing
                    operationReplacements = currentContent.split(searchString).length - 1;
                    if (operationReplacements > 0) {
                        tempContent = currentContent.replaceAll(searchString, op.replace);
                    } else {
                        tempContent = currentContent; // No change
                    }
                }

                if (tempContent !== currentContent) {
                    currentContent = tempContent;
                    totalReplacementsMade += operationReplacements; // Add (potentially inaccurate regex) count
                }
            } // End operations loop

            // Write file only if content actually changed
            if (currentContent !== originalContent) {
                await writeFile(fullPath, currentContent, 'utf-8'); // Use validated path
                contentChanged = true;
                console.error(`Applied ${totalReplacementsMade} replacement(s) to ${relativeFilePath}.`); // Log to stderr
            } else {
                 console.error(`No replacements needed for ${relativeFilePath}.`); // Log to stderr
            }

        } catch (e: any) {
            fileSuccess = false;
            overallSuccess = false;
            fileError = `Error processing file '${relativeFilePath}': ${e.message}`;
            console.error(fileError);
            // let suggestion: string | undefined; // Already declared above
            if (e.code === 'ENOENT') {
                suggestion = `Ensure the file path '${relativeFilePath}' is correct and the file exists.`; // Assign to outer suggestion
            } else if (e.code === 'EACCES') {
                suggestion = `Check read/write permissions for the file '${relativeFilePath}'.`; // Assign to outer suggestion
            } else if (e.message.includes('Invalid regex')) {
                 suggestion = 'Verify the regex pattern syntax in the operations.'; // Assign to outer suggestion
            } else {
                suggestion = `Check file path, permissions, and operation details.`; // Assign to outer suggestion
            }
        }

        fileResults.push({
            path: relativeFilePath,
            success: fileSuccess,
            replacementsMade: totalReplacementsMade,
            contentChanged: contentChanged,
            error: fileError,
            // Use suggestion populated during validation or catch block
            suggestion: !fileSuccess ? suggestion : undefined,
        });
    } // End files loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify({
        summary: `Replace operation completed. Overall success: ${overallSuccess}`,
        results: fileResults
    }, null, 2); // Pretty-print JSON

    return {
      success: overallSuccess,
      results: fileResults, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};