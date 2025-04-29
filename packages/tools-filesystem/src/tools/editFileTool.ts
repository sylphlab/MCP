import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/tools-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import DiffMatchPatch, { type patch_obj } from 'diff-match-patch';
import { z } from 'zod';
import {
  editFileToolInputSchema,
  // type ApplyDiffPatchEditSchema, // Removed invalid import
} from './editFileTool.schema.js';

// Infer the TypeScript type from the Zod schema
export type EditFileToolInput = z.infer<typeof editFileToolInputSchema>;
// Infer the specific edit type we expect (schema enforces only one edit of this type)
type ApplyDiffPatchEdit = EditFileToolInput['changes'][0]['edits'][0];

// --- Output Types (Internal Result Structures) ---
export interface EditResult {
  editIndex: number;
  operation: string;
  success: boolean;
  message?: string;
  error?: string;
  suggestion?: string;
}

export interface FileEditResult {
  path: string;
  success: boolean;
  dryRun: boolean;
  error?: string;
  suggestion?: string;
  oldHash?: string;
  newHash?: string;
  edit_results: EditResult[];
}

// Zod Schema for the individual edit result (part of FileEditResult)
const EditResultSchema = z.object({
  editIndex: z.number(),
  operation: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Zod Schema for the result of processing a single file (used in outputSchema)
const FileEditResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  dryRun: z.boolean(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
  oldHash: z.string().optional(),
  newHash: z.string().optional(),
  edit_results: z.array(EditResultSchema),
});

// Define the specific output schema for this tool
const EditFileOutputSchema = z.array(FileEditResultSchema);

// --- Tool Definition using defineTool ---

export const editFileTool = defineTool({
  name: 'edit-file',
  description: 'Applies precise, context-aware edits to a single file using a diff patch.',
  inputSchema: editFileToolInputSchema, // Schema enforces only one apply_diff_patch

  execute: async (input: EditFileToolInput, options: ToolExecuteOptions): Promise<Part[]> => {
    // Zod validation (throw error on failure)
    const parsed = editFileToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    // Destructure after successful parse. Schema guarantees changes[0] exists.
    const { changes, dryRun: isDryRunGlobal } = parsed.data;
    const change = changes[0];
    // Add explicit check to satisfy TS, though schema guarantees it exists
    if (!change) {
      // This should be unreachable due to schema validation
      throw new Error('Internal error: Failed to access change data after validation.');
    }
    // Schema guarantees only one edit, and it's apply_diff_patch
    const edit = change.edits[0] as ApplyDiffPatchEdit;

    const fileResults: FileEditResult[] = []; // Will contain only one result
    const filePath = change.path;
    const editResults: EditResult[] = [];
    const expectedHash = change.expectedHash;
    let fileSuccess = true;
    let fileError: string | undefined;
    let fileSuggestion: string | undefined;
    let oldFileHash: string | undefined;
    let newFileHash: string | undefined;
    let fullPath: string;
    // apply_diff_patch is considered 'safe' by default unless overridden globally
    const isDryRun = isDryRunGlobal ?? false;

    // --- Validate and Resolve Path ---
    const validationResult = validateAndResolvePath(
      filePath,
      options.workspaceRoot,
      options?.allowOutsideWorkspace,
    );
    if (typeof validationResult !== 'string') {
      fileError = validationResult.error;
      fileSuggestion = validationResult.suggestion;
      fileSuccess = false;
      // Push error result directly as FileEditResult
      fileResults.push({
        path: filePath,
        success: false,
        dryRun: isDryRun,
        error: fileError,
        suggestion: fileSuggestion,
        oldHash: undefined,
        newHash: undefined,
        edit_results: [], // No edits attempted
      });
    } else {
      fullPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for file read/write and patch processing
      try {
        // Read the file content
        const originalFileBuffer = await readFile(fullPath);
        const originalContent = originalFileBuffer.toString('utf-8');
        oldFileHash = createHash('sha256').update(originalFileBuffer).digest('hex');

        // --- Hash Check ---
        if (expectedHash && expectedHash !== oldFileHash) {
          throw new Error(
            `File hash mismatch. Expected ${expectedHash}, but found ${oldFileHash}.`,
          );
        }
        // --- End Hash Check ---

        let currentContent = originalContent;
        let contentModified = false;
        let editSuccess = false;
        let editMessage: string | undefined;
        let editError: string | undefined;
        let suggestion: string | undefined;

        // --- Apply Diff Patch ---
        try {
          const dmp = new DiffMatchPatch();
          let patches: patch_obj[];
          try {
            // Use 'as any' to bypass potential type definition mismatch for patch_fromText
            patches = dmp.patch_fromText(edit.patch) as any;
          } catch (patchError: unknown) {
            throw new Error(
              `Failed to parse patch text: ${patchError instanceof Error ? patchError.message : String(patchError)}`,
            );
          }

          // Use 'as any' to bypass potential type definition mismatch for patch_apply
          const [newContent, patchResults] = dmp.patch_apply(patches as any, currentContent);

          if (patchResults.every((r: boolean) => r)) {
            if (newContent !== currentContent) {
              currentContent = newContent;
              contentModified = true;
              editMessage = 'Patch applied successfully.';
            } else {
              editMessage = 'Patch applied, but resulted in no changes.';
            }
            editSuccess = true;
          } else {
            const failedIndices = patchResults
              .map((r: boolean, i: number) => (!r ? i : -1))
              .filter((i: number) => i !== -1);
            throw new Error(
              `Patch application failed for patch index(es): ${failedIndices.join(', ')}.`,
            );
          }
        } catch (e: unknown) {
          editSuccess = false;
          fileSuccess = false; // Mark file as failed if edit fails
          const errorMsg = e instanceof Error ? e.message : 'Unknown edit error';
          editError = `Edit #0 (${edit.operation}) failed: ${errorMsg}`;
          if (errorMsg.includes('File hash mismatch')) {
            suggestion =
              'File content has changed since last read. Re-read the file and try again.';
          } else if (errorMsg.includes('Patch application failed')) {
            suggestion =
              'The provided patch could not be applied cleanly. Ensure the patch matches the current file content.';
          } else {
            suggestion = 'Check patch content and file state.';
          }
        }
        // --- End Apply Diff Patch ---

        // Push the single edit result
        editResults.push({
          editIndex: 0,
          operation: edit.operation,
          success: editSuccess,
          message: editMessage,
          error: editError,
          suggestion,
        });

        // Calculate potential new hash if modified
        if (contentModified) {
          const finalBuffer = Buffer.from(currentContent, 'utf-8');
          newFileHash = createHash('sha256').update(finalBuffer).digest('hex');
        } else {
          newFileHash = oldFileHash; // No change, hash remains the same
        }

        // Write back only if not dry run, file processing succeeded, and content actually changed
        if (!isDryRun && fileSuccess && contentModified) {
          const finalBuffer = Buffer.from(currentContent, 'utf-8');
          await writeFile(fullPath, finalBuffer);
        } else if (isDryRun && fileSuccess && contentModified) {
          // Add dry run message to the successful edit result
          const successfulEdit = editResults.find((er) => er.editIndex === 0 && er.success);
          if (successfulEdit) {
            successfulEdit.message = `[Dry Run] ${successfulEdit.message ?? 'Patch would be applied.'}`;
          }
        }

        // If the edit failed, overall file success is false
        if (!editSuccess) {
          fileSuccess = false;
        }
      } catch (e: unknown) {
        // Catch errors during file read or hash check
        fileSuccess = false;
        const errorMsg = e instanceof Error ? e.message : 'Unknown file processing error';
        fileError = `Error processing file '${filePath}': ${errorMsg}`;
        if (errorMsg.includes('File hash mismatch')) {
          fileSuggestion =
            'File content has changed since last read. Re-read the file and provide the correct expectedHash.';
        } else {
          fileSuggestion = `Check if file '${filePath}' exists and if you have read/write permissions.`;
        }
        // If read/hash check failed, mark the planned edit as failed if not already done
        if (editResults.length === 0) {
          editResults.push({
            editIndex: 0,
            operation: edit.operation,
            success: false,
            error: `File processing failed before edit: ${errorMsg}`,
            suggestion: fileSuggestion,
          });
        }
      }

      // Push the final result for this file change
      fileResults.push({
        path: filePath,
        success: fileSuccess,
        dryRun: isDryRun,
        error: fileError, // File-level error (read/hash/path validation)
        suggestion: fileSuggestion, // File-level suggestion
        oldHash: oldFileHash,
        newHash: newFileHash,
        edit_results: editResults, // Results of individual edits (patch apply)
      });
    } // End if/else block for path validation

    // Return the parts array directly
    return [jsonPart(fileResults, EditFileOutputSchema)];
  }, // Closing brace for execute method
}); // Closing brace for defineTool call
