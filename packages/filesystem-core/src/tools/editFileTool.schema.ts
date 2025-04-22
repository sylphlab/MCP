import { z } from 'zod';

// --- Zod Schema for the Apply Diff Patch Operation ---

// Schema for the apply_diff_patch operation
const ApplyDiffPatchOperationSchema = z.object({
  operation: z.literal('apply_diff_patch'),
  patch: z.string().min(1, 'Patch content cannot be empty.'),
  // Note: This operation ignores start_line/end_line as diff contains context
});

// The only allowed edit operation
export const EditOperationSchema = ApplyDiffPatchOperationSchema;

// Schema for a single file change request, now restricted to one apply_diff_patch edit
export const FileChangeSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty.'),
  expectedHash: z.string().optional(), // Optional expected SHA-256 hash
  // Enforce exactly one edit, which must be apply_diff_patch
  edits: z
    .array(ApplyDiffPatchOperationSchema)
    .length(1, 'Exactly one apply_diff_patch operation is required.'),
});

// Main input schema: restricted to exactly one file change
export const editFileToolInputSchema = z.object({
  // Enforce exactly one change
  changes: z.array(FileChangeSchema).length(1, 'Exactly one file change is required.'),
  dryRun: z.boolean().optional(), // Optional dry run flag
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});
