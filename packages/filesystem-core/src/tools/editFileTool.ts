import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput, validateAndResolvePath, PathValidationError, McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import base types and validation util

// --- Zod Schemas for Edit Operations ---

const InsertOperationSchema = z.object({
    operation: z.literal('insert'),
    start_line: z.number().int().min(1, 'start_line must be 1 or greater'),
    content: z.string(),
});

const DeleteLinesOperationSchema = z.object({
    operation: z.literal('delete_lines'),
    start_line: z.number().int().min(1, 'start_line must be 1 or greater'),
    end_line: z.number().int().min(1, 'end_line must be 1 or greater'),
});
// Refinement moved to superRefine below

const ReplaceLinesOperationSchema = z.object({
    operation: z.literal('replace_lines'),
    start_line: z.number().int().min(1, 'start_line must be 1 or greater'),
    end_line: z.number().int().min(1, 'end_line must be 1 or greater'),
    content: z.string(),
});
// Refinement moved to superRefine below

const SearchReplaceTextOperationSchema = z.object({
    operation: z.literal('search_replace_text'),
    search: z.string().min(1, 'search pattern cannot be empty'),
    replace: z.string(),
    start_line: z.number().int().min(1).optional(),
    end_line: z.number().int().min(1).optional(),
});
// Refinement moved to superRefine below

const SearchReplaceRegexOperationSchema = z.object({
    operation: z.literal('search_replace_regex'),
    regex: z.string().min(1, 'regex pattern cannot be empty'),
    replace: z.string(),
    flags: z.string().optional(), // e.g., 'g', 'i', 'm', 'gi'
    start_line: z.number().int().min(1).optional(),
    end_line: z.number().int().min(1).optional(),
});
// Refinement moved to superRefine below

// Discriminated union for all possible edit operations
const EditOperationSchema = z.discriminatedUnion('operation', [
    InsertOperationSchema,
    DeleteLinesOperationSchema,
    ReplaceLinesOperationSchema,
    SearchReplaceTextOperationSchema,
    SearchReplaceRegexOperationSchema,
]).superRefine((data, ctx) => {
    // Apply refinement for schemas that have start_line and end_line
    if ('start_line' in data && 'end_line' in data && data.start_line && data.end_line) {
        if (data.end_line < data.start_line) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'end_line must be greater than or equal to start_line',
                path: ['end_line'],
            });
        }
    }
});

const FileChangeSchema = z.object({
    path: z.string().min(1, 'path cannot be empty'),
    edits: z.array(EditOperationSchema).min(1, 'edits array cannot be empty'),
});

export const EditFileToolInputSchema = z.object({
  changes: z.array(FileChangeSchema).min(1, 'changes array cannot be empty'),
  // allowOutsideWorkspace is handled internally via options, not part of the input schema
});

// Infer the TypeScript type from the Zod schema
export type EditFileToolInput = z.infer<typeof EditFileToolInputSchema>;
export type EditOperation = z.infer<typeof EditOperationSchema>;

// --- Output Types ---
export interface EditResult {
    /** Index of the edit operation in the input array. */
    editIndex: number;
    /** Whether this specific edit was applied successfully. */
    success: boolean;
    /** Optional message (e.g., "Inserted content", "Replaced 3 occurrences"). */
    message?: string;
    /** Optional error if this specific edit failed. */
    error?: string;
    /** Optional suggestion for fixing the error. */
    suggestion?: string;
}

export interface FileEditResult {
    /** The file path provided in the input. */
    path: string;
    /** Whether all edits for this file were applied successfully. */
    success: boolean;
    /** Optional error message if file reading/writing failed or a major issue occurred. */
    error?: string;
    /** Optional suggestion if file processing failed early (e.g., path validation or read error). */
    suggestion?: string;
    /** Array of results for each edit operation applied to this file. */
    edit_results: EditResult[];
}

// Extend the base output type
export interface EditFileToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true only if ALL file changes were fully successful). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each file change operation. */
  results: FileEditResult[];
}

// --- Tool Definition (following SDK pattern) ---

export const editFileTool: McpTool<typeof EditFileToolInputSchema, EditFileToolOutput> = {
  name: 'editFileTool',
  description: 'Applies selective edits (insert, delete, replace by line or search pattern) to one or more files.',
  inputSchema: EditFileToolInputSchema,

  async execute(input: EditFileToolInput, workspaceRoot: string, options?: McpToolExecuteOptions): Promise<EditFileToolOutput> { // Add options
    // Zod validation
    const parsed = EditFileToolInputSchema.safeParse(input);
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
    const { changes } = parsed.data;
    // --- End Zod Validation ---

    const fileResults: FileEditResult[] = [];
    let overallSuccess = true;

    try { // Add top-level try block

      for (const change of changes) {
          const filePath = change.path;
          const editResults: EditResult[] = [];
          let fileSuccess = true;
          let fileError: string | undefined;
          let fileSuggestion: string | undefined;

          // --- Validate and Resolve Path ---
          const validationResult = validateAndResolvePath(filePath, workspaceRoot, options?.allowOutsideWorkspace);
          if (typeof validationResult !== 'string') {
              fileError = validationResult.error;
              fileSuggestion = validationResult.suggestion;
              console.error(`Skipping file ${filePath}: ${fileError}`);
              fileSuccess = false;
              overallSuccess = false;
              fileResults.push({ path: filePath, success: false, error: fileError, suggestion: fileSuggestion, edit_results: [] });
              continue;
          }
          const fullPath = validationResult;
          // --- End Path Validation ---

          try {
              // Read the file content
              const originalContent = await readFile(fullPath, 'utf-8');
              let lines = originalContent.split(/\r?\n/);
              let currentLines = [...lines];

              for (const [index, edit] of change.edits.entries()) {
                  let editSuccess = false;
                  let editMessage: string | undefined;
                  let editError: string | undefined;
                  let suggestion: string | undefined;
                  const currentLineCount = currentLines.length;

                  try {
                      const startLineIndex = edit.start_line ? edit.start_line - 1 : 0;

                      // --- Start Line Boundary Check ---
                      const maxStartIndex = (edit.operation === 'insert') ? currentLineCount : currentLineCount -1;
                      const maxStartLine = (edit.operation === 'insert') ? currentLineCount + 1 : currentLineCount;
                      if (edit.start_line && (startLineIndex < 0 || startLineIndex > maxStartIndex)) {
                           throw new Error(`start_line ${edit.start_line} is out of bounds (1-${maxStartLine}).`);
                      }
                      // --- End Start Line Boundary Check ---

                      switch (edit.operation) {
                          case 'insert': {
                              const contentLines = edit.content.split(/\r?\n/);
                              const insertIndex = Math.min(startLineIndex, currentLineCount);
                              currentLines.splice(insertIndex, 0, ...contentLines);
                              editMessage = `Inserted ${contentLines.length} line(s) at line ${edit.start_line}.`;
                              editSuccess = true;
                              break;
                          }
                          case 'delete_lines': {
                              const endLineIndex = edit.end_line - 1;
                              if (endLineIndex < 0 || endLineIndex >= currentLineCount) {
                                  throw new Error(`end_line ${edit.end_line} is out of bounds (1-${currentLineCount}).`);
                              }
                               if (endLineIndex < startLineIndex) {
                                  throw new Error(`end_line ${edit.end_line} cannot be less than start_line ${edit.start_line}.`);
                              }
                              const deleteCount = endLineIndex - startLineIndex + 1;
                              if (startLineIndex >= currentLineCount) throw new Error(`start_line ${edit.start_line} is out of bounds.`);
                              currentLines.splice(startLineIndex, deleteCount);
                              editMessage = `Deleted ${deleteCount} line(s) from line ${edit.start_line}.`;
                              editSuccess = true;
                              break;
                          }
                          case 'replace_lines': {
                               const endLineIndex = edit.end_line - 1;
                               if (endLineIndex < 0 || endLineIndex >= currentLineCount) {
                                   throw new Error(`end_line ${edit.end_line} is out of bounds (1-${currentLineCount}).`);
                               }
                                if (endLineIndex < startLineIndex) {
                                   throw new Error(`end_line ${edit.end_line} cannot be less than start_line ${edit.start_line}.`);
                               }
                              const deleteCount = endLineIndex - startLineIndex + 1;
                               if (startLineIndex >= currentLineCount) throw new Error(`start_line ${edit.start_line} is out of bounds.`);
                              const contentLines = edit.content.split(/\r?\n/);
                              currentLines.splice(startLineIndex, deleteCount, ...contentLines);
                              editMessage = `Replaced ${deleteCount} line(s) starting at line ${edit.start_line} with ${contentLines.length} line(s).`;
                              editSuccess = true;
                              break;
                          }
                          case 'search_replace_text':
                          case 'search_replace_regex': {
                               const endLineIndex = edit.end_line ? edit.end_line - 1 : currentLineCount - 1;
                               if (edit.end_line && (endLineIndex < 0 || endLineIndex >= currentLineCount)) {
                                   throw new Error(`end_line ${edit.end_line} is out of bounds (1-${currentLineCount}).`);
                               }
                                if (edit.start_line && edit.end_line && endLineIndex < startLineIndex) {
                                   throw new Error(`end_line ${edit.end_line} cannot be less than start_line ${edit.start_line}.`);
                               }
                              let replacementsMade = 0;
                              const effectiveStart = startLineIndex;
                              const effectiveEnd = Math.min(endLineIndex, currentLineCount - 1);
                              let regex: RegExp | null = null;

                              if (edit.operation === 'search_replace_regex') {
                                  try {
                                      regex = new RegExp(edit.regex, edit.flags ?? '');
                                  } catch (e: any) {
                                      throw new Error(`Invalid regex pattern: ${e.message}`);
                                  }
                              }

                              for (let i = effectiveStart; i <= effectiveEnd; i++) {
                                  const originalLine = currentLines[i];
                                  if (originalLine === undefined) continue;

                                  let modifiedLine: string;
                                  if (regex) {
                                      modifiedLine = originalLine.replace(regex, edit.replace);
                                  } else if (edit.operation === 'search_replace_text') {
                                      modifiedLine = originalLine.replaceAll(edit.search, edit.replace);
                                  } else {
                                      modifiedLine = originalLine;
                                  }

                                  if (originalLine !== modifiedLine) {
                                      currentLines[i] = modifiedLine;
                                      replacementsMade++;
                                  }
                              }
                              editMessage = `Made ${replacementsMade} replacement(s) between lines ${edit.start_line ?? 1} and ${edit.end_line ?? currentLineCount}.`;
                              editSuccess = true;
                              break;
                          }
                      }
                  } catch (e: any) {
                      editSuccess = false;
                      fileSuccess = false;
                      editError = `Edit #${index} (${edit.operation}) failed: ${e.message}`;
                      if (e.message.includes('out of bounds')) {
                          suggestion = `Check line numbers (1-${currentLineCount}). Ensure start_line <= end_line.`;
                      } else if (e.message.includes('Invalid regex')) {
                          suggestion = 'Verify the regex pattern syntax.';
                      } else {
                          suggestion = 'Check edit operation parameters and file content.';
                      }
                      console.error(`Error applying edit to ${filePath}: ${editError}`);
                  }

                  editResults.push({ editIndex: index, success: editSuccess, message: editMessage, error: editError, suggestion });
                  // if (!editSuccess) break; // Temporarily remove break
              }

              // If all edits for the file were successful, write back
              if (fileSuccess) {
                  const modifiedContent = currentLines.join('\n');
                  if (modifiedContent !== originalContent) {
                      await writeFile(fullPath, modifiedContent, 'utf-8');
                      console.error(`Successfully applied edits to ${filePath}.`);
                  } else {
                       console.error(`No changes needed for ${filePath}.`);
                  }
              } else {
                  overallSuccess = false;
              }

          } catch (e: any) { // Catch errors during file read or edit loop
              fileSuccess = false;
              overallSuccess = false; // Mark overall as failed
              fileError = `Error processing file '${filePath}': ${e.message}`;
              console.error(fileError);
              const suggestion = `Check if file '${filePath}' exists and if you have read/write permissions.`;
              if (editResults.length === 0) {
                  change.edits.forEach((editOp, index) => {
                      editResults.push({ editIndex: index, success: false, error: `File processing failed before edit: ${e.message}`, suggestion });
                  });
              }
          }

          fileResults.push({
              path: filePath,
              success: fileSuccess,
              error: fileError,
              suggestion: fileSuggestion,
              edit_results: editResults,
            });
      } // End for loop

      // Return results after processing all changes
      console.log(`[Debug] Returning from try. fileResults length: ${fileResults.length}`); // Log before return
      return {
        success: overallSuccess,
        results: fileResults,
        content: overallSuccess
          ? [{ type: 'text', text: `Edit operation completed. Success: ${overallSuccess}` }]
          : [],
      };

    } catch (unexpectedError: any) { // Catch unexpected errors during the main loop/setup
        console.error(`Unexpected error during editFileTool execution: ${unexpectedError.message}`);
        console.log(`[Debug] Returning from catch. fileResults length: ${fileResults.length}`); // Log before return
        // Return minimal error structure on unexpected failure
        return {
            success: false,
            error: `Unexpected tool error: ${unexpectedError.message}`,
            results: [], // Return empty results on unexpected error
            content: [],
        };
    }
  }, // Closing brace for execute method
}; // Closing brace for tool object