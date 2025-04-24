import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/mcp-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import { type WriteFileItemSchema, writeFilesToolInputSchema } from './writeFilesTool.schema.js';

// Define BufferEncoding type for Zod schema
type BufferEncoding = 'utf-8' | 'base64';

// Infer the TypeScript type from the Zod schema
export type WriteFilesToolInput = z.infer<typeof writeFilesToolInputSchema>;
// Infer item type if needed, though schema might handle it
// export type WriteFileItem = z.infer<typeof WriteFileItemSchema>;

// --- Output Types ---
export interface WriteFileResult {
  path: string;
  success: boolean;
  /** Indicates if the operation was a dry run. */
  dryRun: boolean;
  /** SHA-256 hash of the file content *before* modifications (if applicable and calculated). */
  oldHash?: string;
  /** SHA-256 hash of the file content *after* successful modifications (if not dryRun). */
  newHash?: string;
  message?: string;
  error?: string;
  suggestion?: string;
}

// Zod Schema for the individual write result (used in outputSchema)
const WriteFileResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  dryRun: z.boolean(),
  oldHash: z.string().optional(),
  newHash: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant
const WriteFilesOutputSchema = z.array(WriteFileResultSchema);

// --- Tool Definition using defineTool ---

export const writeFilesTool = defineTool({
  name: 'writeFilesTool',
  description: 'Writes or appends content to one or more files within the workspace.',
  inputSchema: writeFilesToolInputSchema,

  execute: async (input: WriteFilesToolInput, options: ToolExecuteOptions): Promise<Part[]> => {
    // Zod validation (throw error on failure)
    const parsed = writeFilesToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { items, encoding, append } = parsed.data;
    // Determine dryRun: default false for append (safer), true for overwrite (!append)
    const isDryRun = parsed.data.dryRun ?? !append;

    const results: WriteFileResult[] = [];

    for (const item of items) {
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      let suggestion: string | undefined;
      let oldFileHash: string | undefined;
      let newFileHash: string | undefined;
      let resolvedPath: string | undefined;
      const operation = append ? 'append' : 'write';

      // --- Validate Path ---
      const validationResult = validateAndResolvePath(
        item.path,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = validationResult?.error ?? 'Unknown path validation error';
        suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
        results.push({ path: item.path, success: false, dryRun: isDryRun, error, suggestion });
        continue; // Skip this item
      }
      resolvedPath = validationResult;
      // --- End Path Validation ---

      try {
        // --- Hash Check (only for overwrite mode) ---
        let fileExists = false;
        try {
          // Attempt to get stats to check existence and calculate old hash if needed
          const originalBuffer = await readFile(resolvedPath);
          oldFileHash = createHash('sha256').update(originalBuffer).digest('hex');
          fileExists = true;
          if (!append && item.expectedHash && item.expectedHash !== oldFileHash) {
            throw new Error(
              `File hash mismatch. Expected ${item.expectedHash}, but found ${oldFileHash}.`,
            );
          }
        } catch (readError: unknown) {
          if (
            readError &&
            typeof readError === 'object' &&
            'code' in readError &&
            (readError as { code: unknown }).code === 'ENOENT'
          ) {
            // File doesn't exist
            fileExists = false;
            oldFileHash = undefined;
            // If expecting a hash for a non-existent file during overwrite, it's an error (unless hash is explicitly null/undefined? Schema should clarify)
            // For now, assume providing expectedHash implies the file should exist for overwrite.
            if (!append && item.expectedHash) {
              throw new Error(
                `File expected to exist for hash check (overwrite mode), but not found at '${item.path}'.`,
              );
            }
          } else {
            throw readError; // Re-throw other read errors
          }
        }
        // --- End Hash Check ---

        // Prepare content buffer and calculate potential new hash
        const contentBuffer = Buffer.from(item.content, encoding as BufferEncoding);
        let finalContentBuffer = contentBuffer;

        if (append && fileExists) {
          // Read again only if appending and file exists to get current content for final hash
          const originalBufferForAppend = await readFile(resolvedPath);
          finalContentBuffer = Buffer.concat([originalBufferForAppend, contentBuffer]);
        } else if (append && !fileExists) {
          // If appending to a non-existent file, it's effectively a write
          finalContentBuffer = contentBuffer;
        }
        // Always calculate the hash of what *would* be written
        newFileHash = createHash('sha256').update(finalContentBuffer).digest('hex');

        if (isDryRun) {
          message = `[Dry Run] Would ${append ? 'append to' : 'write'} file '${item.path}'.`;
          itemSuccess = true;
        } else {
          // Actual operation: Ensure parent directory exists
          const dir = path.dirname(resolvedPath);
          await mkdir(dir, { recursive: true });

          // Perform write or append
          const writeOptions = { encoding: encoding as BufferEncoding };
          if (append) {
            await appendFile(resolvedPath, contentBuffer, writeOptions);
            message = `Content appended successfully to '${item.path}'.`;
          } else {
            await writeFile(resolvedPath, contentBuffer, writeOptions);
            message = `File written successfully to '${item.path}'.`;
          }
          itemSuccess = true;
        }
      } catch (e: unknown) {
        itemSuccess = false;
        let errorCode: string | null = null;
        let errorMsg = 'Unknown error';

        if (e && typeof e === 'object') {
          if ('code' in e) errorCode = String((e as { code: unknown }).code);
        }
        if (e instanceof Error) errorMsg = e.message;

        error = `Failed to ${operation} file '${item.path}': ${errorMsg}`;
        if (errorMsg.includes('File hash mismatch')) {
          suggestion =
            'File content has changed since last read. Re-read the file and provide the correct expectedHash, or omit expectedHash.';
        } else if (errorMsg.includes('File expected to exist')) {
          suggestion =
            'The file was expected to exist for hash checking during overwrite, but was not found. Verify path or omit expectedHash if creation is intended.';
        } else if (errorCode === 'EACCES') {
          suggestion = `Check write permissions for the directory containing '${item.path}'.`;
        } else if (errorCode === 'EISDIR') {
          suggestion = `The path '${item.path}' points to a directory. Provide a path to a file.`;
        } else if (errorCode === 'EROFS') {
          suggestion = `The file system at '${item.path}' is read-only.`;
        } else {
          suggestion = 'Check the file path, permissions, and available disk space.';
        }
      }

      // Push result for this item
      results.push({
        path: item.path,
        success: itemSuccess,
        dryRun: isDryRun,
        oldHash: oldFileHash,
        newHash: itemSuccess ? newFileHash : undefined,
        message: itemSuccess ? message : undefined,
        error,
        suggestion: !itemSuccess ? suggestion : undefined,
      });
    } // End loop

    // Return the parts array directly
    return [jsonPart(results, WriteFilesOutputSchema)];
  },
});
