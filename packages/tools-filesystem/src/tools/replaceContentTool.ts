import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/tools-core';
import {
  jsonPart,
  textPart, // Keep textPart for summary
  validateAndResolvePath,
} from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import glob from 'fast-glob';
import { z } from 'zod';
import {
  type ReplaceOperationSchema,
  replaceContentToolInputSchema,
} from './replaceContentTool.schema.js';

// Infer the TypeScript type from the Zod schema
export type ReplaceContentToolInput = z.infer<typeof replaceContentToolInputSchema>;
export type ReplaceOperation = z.infer<typeof ReplaceOperationSchema>;

// --- Output Types ---
export interface FileReplaceResult {
  /** The file path processed (relative to workspace root). */
  path: string;
  /** Whether the replacement operations for this specific file were successful. */
  success: boolean;
  /** Indicates if the operation was a dry run. */
  dryRun: boolean;
  /** Number of replacements made in this file across all operations. */
  replacementsMade: number;
  /** True if the file content was actually changed and written back (or would have been in dry run). */
  contentChanged: boolean;
  /** SHA-256 hash of the file content *before* modifications (if calculated). */
  oldHash?: string;
  /** SHA-256 hash of the file content *after* successful modifications (if not dryRun). */
  newHash?: string;
  /** Optional error message if processing failed for this file. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual file result (used in outputSchema)
const FileReplaceResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  dryRun: z.boolean(),
  replacementsMade: z.number(),
  contentChanged: z.boolean(),
  oldHash: z.string().optional(),
  newHash: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant
const ReplaceContentOutputSchema = z.array(FileReplaceResultSchema);

// --- Tool Definition using defineTool ---

export const replaceContentTool = defineTool({
  name: 'replaceContentTool',
  description: 'Performs search and replace operations across multiple files (supports globs).',
  inputSchema: replaceContentToolInputSchema,

  execute: async (
    input: ReplaceContentToolInput,
    options: ToolExecuteOptions,
  ): Promise<Part[]> => {
    // Zod validation (throw error on failure)
    const parsed = replaceContentToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { paths: pathPatterns, operations } = parsed.data;
    // Get dryRun flag, default to true as replace is considered unsafe
    const isDryRun = parsed.data.dryRun ?? true;

    const fileResults: FileReplaceResult[] = [];
    let resolvedFilePaths: string[] = [];

    // Keep try/catch for glob errors
    try {
      resolvedFilePaths = await glob(pathPatterns, {
        cwd: options.workspaceRoot,
        absolute: false,
        onlyFiles: true,
        dot: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });

      if (resolvedFilePaths.length === 0) {
        // If no files match, return empty results
        return [
          jsonPart([], ReplaceContentOutputSchema),
          textPart('No files matched the provided patterns.'),
        ];
      }
    } catch (globError: unknown) {
      const errorMsg = globError instanceof Error ? globError.message : 'Unknown glob error';
      throw new Error(`Glob pattern error: ${errorMsg}`);
    }

    for (const relativeFilePath of resolvedFilePaths) {
      const fullPath = path.resolve(options.workspaceRoot, relativeFilePath);
      let fileSuccess = true;
      let fileError: string | undefined;
      let totalReplacementsMade = 0;
      let contentChanged = false;
      let oldFileHash: string | undefined;
      let newFileHash: string | undefined;
      let suggestion: string | undefined;

      // --- Path Validation ---
      const relativeCheck = path.relative(options.workspaceRoot, fullPath);
      if (
        !options?.allowOutsideWorkspace &&
        (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck))
      ) {
        fileError = `Path validation failed: Matched file '${relativeFilePath}' is outside workspace root.`;
        suggestion = `Ensure the path pattern '${pathPatterns.join(', ')}' does not resolve to paths outside the workspace.`;
        fileSuccess = false;
        fileResults.push({
          path: relativeFilePath,
          success: false,
          dryRun: isDryRun,
          replacementsMade: 0,
          contentChanged: false,
          error: fileError,
          suggestion,
        });
        continue; // Skip this file
      }
      // --- End Path Validation ---

      try {
        const originalContent = await readFile(fullPath, 'utf-8');
        const originalBuffer = Buffer.from(originalContent, 'utf-8');
        oldFileHash = createHash('sha256').update(originalBuffer).digest('hex');
        let currentContent = originalContent;

        for (const op of operations) {
          let operationReplacements = 0;
          let tempContent = '';
          if (op.isRegex) {
            try {
              const regex = new RegExp(op.search, op.flags ?? '');
              tempContent = currentContent.replace(regex, op.replace);
              if (tempContent !== currentContent) {
                // Count matches accurately for regex replacement
                operationReplacements = (currentContent.match(regex) || []).length;
              }
            } catch (e: unknown) {
              const errorMsg = e instanceof Error ? e.message : 'Unknown regex error';
              throw new Error(`Invalid regex '${op.search}': ${errorMsg}`);
            }
          } else {
            const searchString = op.search;
            // Count occurrences for simple string replacement
            operationReplacements = currentContent.split(searchString).length - 1;
            if (operationReplacements > 0) {
              tempContent = currentContent.replaceAll(searchString, op.replace);
            } else {
              tempContent = currentContent; // No change if no occurrences
            }
          }

          if (tempContent !== currentContent) {
            currentContent = tempContent;
            totalReplacementsMade += operationReplacements;
          }
        } // End operations loop

        if (currentContent !== originalContent) {
          contentChanged = true;
          const finalBuffer = Buffer.from(currentContent, 'utf-8');
          newFileHash = createHash('sha256').update(finalBuffer).digest('hex');

          if (!isDryRun) {
            await writeFile(fullPath, finalBuffer);
          }
        } else {
          newFileHash = oldFileHash;
        }
      } catch (e: unknown) {
        fileSuccess = false;
        let errorCode: string | null = null;
        let errorMsg = 'Unknown error';

        if (e && typeof e === 'object') {
          if ('code' in e) errorCode = String((e as { code: unknown }).code);
        }
        if (e instanceof Error) errorMsg = e.message;

        fileError = `Error processing file '${relativeFilePath}': ${errorMsg}`;
        if (errorCode === 'ENOENT') {
          suggestion = `Ensure the file path '${relativeFilePath}' is correct and the file exists.`;
        } else if (errorCode === 'EACCES') {
          suggestion = `Check read/write permissions for the file '${relativeFilePath}'.`;
        } else if (errorMsg.includes('Invalid regex')) {
          suggestion = 'Verify the regex pattern syntax in the operations.';
        } else {
          suggestion = 'Check file path, permissions, and operation details.';
        }
      }

      // Push result for this file (including errors)
      fileResults.push({
        path: relativeFilePath,
        success: fileSuccess,
        dryRun: isDryRun,
        replacementsMade: totalReplacementsMade,
        contentChanged: contentChanged,
        oldHash: oldFileHash,
        newHash: fileSuccess ? newFileHash : undefined, // Only include newHash on success
        error: fileError,
        suggestion: !fileSuccess ? suggestion : undefined,
      });
    } // End files loop

    // Construct parts array
    const finalParts: Part[] = [
      jsonPart(fileResults, ReplaceContentOutputSchema),
      textPart(
        `Replace operation attempted for ${resolvedFilePaths.length} matched file(s). ${fileResults.filter((r) => r.success).length} processed successfully, ${fileResults.filter((r) => r.contentChanged).length} changed.`,
      ), // Added summary
    ];

    // Return the parts array directly
    return finalParts;
  },
});
