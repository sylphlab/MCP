import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core'; // Import the helper
import {
  type BaseMcpToolOutput,
  type McpTool, // McpTool might not be needed directly
  type McpToolExecuteOptions,
  McpToolInput, // McpToolInput might not be needed directly
  PathValidationError, // PathValidationError might not be needed directly
  validateAndResolvePath,
} from '@sylphlab/mcp-core'; // Import base types and validation util
import type { z } from 'zod';
import {
  type EditOperationSchema,
  type FileChangeSchema,
  editFileToolInputSchema,
} from './editFileTool.schema.js'; // Import schemas (added .js)

// Infer the TypeScript type from the Zod schema
export type EditFileToolInput = z.infer<typeof editFileToolInputSchema>;
export type EditOperation = z.infer<typeof EditOperationSchema>;

// --- Output Types ---
export interface EditResult {
  /** Index of the edit operation in the input array. */
  editIndex: number;
  /** Whether this specific edit was applied successfully. */
  success: boolean;
  /** Optional message (e.g., "Inserted content", "Replacements made"). */ // Updated message example
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

// --- Tool Definition using defineTool ---

export const editFileTool = defineTool({
  name: 'editFileTool',
  description:
    'Applies selective edits (insert, delete, replace by line or search pattern) to one or more files.',
  inputSchema: editFileToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: EditFileToolInput,
    options: McpToolExecuteOptions,
  ): Promise<EditFileToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = editFileToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      // Return error structure instead of throwing
      return {
        success: false,
        error: `Input validation failed: ${errorMessages}`,
        results: [], // Ensure results is an empty array on validation failure
        content: [{ type: 'text', text: `Input validation failed: ${errorMessages}` }],
      };
    }
    const { changes } = parsed.data;

    const fileResults: FileEditResult[] = [];
    let overallSuccess = true; // Assume success until a failure occurs

    // Removed the outermost try/catch block; defineTool handles unexpected errors

    for (const change of changes) {
      const filePath = change.path;
      const editResults: EditResult[] = [];
      let fileSuccess = true; // Success for this specific file
      let fileError: string | undefined;
      let fileSuggestion: string | undefined;
      let fullPath: string;

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
        overallSuccess = false; // Mark overall as failed
        fileResults.push({
          path: filePath, success: false, error: fileError, suggestion: fileSuggestion, edit_results: [],
        });
        continue; // Skip this file change
      }
      fullPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for file read/write and edit loop processing
      try {
        // Read the file content
        const originalContent = await readFile(fullPath, 'utf-8');
        const lines = originalContent === '' ? [] : originalContent.split(/\r?\n/);
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.pop();
        }
        const currentLines = [...lines];

        // Process edits for this file
        for (const [index, edit] of change.edits.entries()) {
          let editSuccess = false;
          let editMessage: string | undefined;
          let editError: string | undefined;
          let suggestion: string | undefined;
          const currentLineCount = currentLines.length;

          // Keep try/catch for individual edit operation errors
          try {
            const startLine = edit.start_line ?? 1;
            const startLineIndex = startLine - 1;

            // Boundary checks... (kept as before)
            const maxStartIndex = edit.operation === 'insert' ? currentLineCount : Math.max(0, currentLineCount - 1);
            const maxStartLine = edit.operation === 'insert' ? currentLineCount + 1 : currentLineCount;
            if (startLineIndex < 0 || startLineIndex > maxStartIndex) {
              throw new Error(`start_line ${startLine} is out of bounds (1-${maxStartLine}).`);
            }

            switch (edit.operation) {
              case 'insert': {
                const contentLines = edit.content.split(/\r?\n/);
                const insertIndex = Math.min(startLineIndex, currentLineCount);
                currentLines.splice(insertIndex, 0, ...contentLines);
                editMessage = `Inserted ${contentLines.length} line(s) at line ${startLine}.`;
                editSuccess = true;
                break;
              }
              case 'delete_lines': {
                const endLine = edit.end_line;
                const endLineIndex = endLine - 1;
                if (endLineIndex < 0 || endLineIndex >= currentLineCount) {
                  throw new Error(`end_line ${endLine} is out of bounds (1-${currentLineCount}).`);
                }
                const deleteCount = endLineIndex - startLineIndex + 1;
                currentLines.splice(startLineIndex, deleteCount);
                editMessage = `Deleted ${deleteCount} line(s) from line ${startLine}.`;
                editSuccess = true;
                break;
              }
              case 'replace_lines': {
                const endLine = edit.end_line;
                const endLineIndex = endLine - 1;
                if (endLineIndex < 0 || endLineIndex >= currentLineCount) {
                  throw new Error(`end_line ${endLine} is out of bounds (1-${currentLineCount}).`);
                }
                const deleteCount = endLineIndex - startLineIndex + 1;
                const contentLines = edit.content.split(/\r?\n/);
                currentLines.splice(startLineIndex, deleteCount, ...contentLines);
                editMessage = `Replaced ${deleteCount} line(s) starting at line ${startLine} with ${contentLines.length} line(s).`;
                editSuccess = true;
                break;
              }
              case 'search_replace_text':
              case 'search_replace_regex': {
                const endLine = edit.end_line ?? currentLineCount;
                const endLineIndex = endLine - 1;
                if (endLineIndex < 0 || endLineIndex >= currentLineCount) {
                  throw new Error(`end_line ${endLine} is out of bounds (1-${currentLineCount}).`);
                }
                let replacementsMade = 0;
                const effectiveStart = startLineIndex;
                const effectiveEnd = Math.min(endLineIndex, currentLineCount - 1);
                let regex: RegExp | null = null;

                if (edit.operation === 'search_replace_regex') {
                  try {
                    regex = new RegExp(edit.regex, edit.flags ?? '');
                  } catch (e: unknown) {
                    const errorMsg = e instanceof Error ? e.message : 'Unknown regex error';
                    throw new Error(`Invalid regex pattern: ${errorMsg}`);
                  }
                }

                for (let i = effectiveStart; i <= effectiveEnd; i++) {
                  const originalLine = currentLines[i];
                  if (originalLine === undefined) continue;
                  let modifiedLine: string;
                  let lineReplacements = 0;
                  if (regex) {
                    modifiedLine = originalLine.replace(regex, edit.replace);
                    lineReplacements = (originalLine.match(regex) || []).length;
                  } else if (edit.operation === 'search_replace_text') {
                    modifiedLine = originalLine.replace(edit.search, edit.replace);
                    if (originalLine !== modifiedLine) lineReplacements = 1;
                  } else {
                    modifiedLine = originalLine;
                  }
                  if (originalLine !== modifiedLine) {
                    currentLines[i] = modifiedLine;
                    replacementsMade += lineReplacements;
                  }
                }
                editMessage = `${replacementsMade} replacement(s) made between lines ${startLine} and ${endLine}.`;
                if (replacementsMade === 0) editMessage = `No replacements needed between lines ${startLine} and ${endLine}.`;
                editSuccess = true;
                break;
              }
            }
          } catch (e: unknown) {
            // Handle individual edit errors
            editSuccess = false;
            fileSuccess = false; // Mark file as failed if any edit fails
            const errorMsg = e instanceof Error ? e.message : 'Unknown edit error';
            editError = `Edit #${index} (${edit.operation}) failed: ${errorMsg}`;
            if (errorMsg.includes('out of bounds')) {
              suggestion = `Check line numbers (1-${currentLineCount}). Ensure start_line <= end_line.`;
            } else if (errorMsg.includes('Invalid regex')) {
              suggestion = 'Verify the regex pattern syntax.';
            } else {
              suggestion = 'Check edit operation parameters and file content.';
            }
          }

          // Push result for this edit
          editResults.push({ editIndex: index, success: editSuccess, message: editMessage, error: editError, suggestion });
        } // End for loop for edits

        // Write back if the file processing itself didn't fail and edits were attempted
        if (fileSuccess) {
          const modifiedContentJoined = currentLines.join('\n');
          const originalContentTrimmed = originalContent.replace(/\r?\n$/, '');
          if (modifiedContentJoined !== originalContentTrimmed) {
            await writeFile(fullPath, modifiedContentJoined, 'utf-8');
          }
        } else {
           overallSuccess = false; // Ensure overall success reflects file failure
        }

      } catch (e: unknown) {
        // Catch errors during file read or initial processing
        fileSuccess = false;
        overallSuccess = false;
        const errorMsg = e instanceof Error ? e.message : 'Unknown file processing error';
        fileError = `Error processing file '${filePath}': ${errorMsg}`;
        fileSuggestion = `Check if file '${filePath}' exists and if you have read/write permissions.`;
        // If read failed, mark all planned edits as failed
        if (editResults.length === 0) {
          change.edits.forEach((_editOp, index) => {
            editResults.push({
              editIndex: index, success: false, error: `File processing failed before edit: ${errorMsg}`, suggestion: fileSuggestion,
            });
          });
        }
      }

      // Push result for this file change
      fileResults.push({
        path: filePath, success: fileSuccess, error: fileError, suggestion: fileSuggestion, edit_results: editResults,
      });
    } // End for loop for changes

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Edit operation completed. Overall success: ${overallSuccess}`,
        results: fileResults,
      },
      null,
      2,
    );

    // Return the specific output structure
    return {
      success: overallSuccess,
      results: fileResults,
      content: [{ type: 'text', text: contentText }],
    };
  }, // Closing brace for execute method
}); // Closing brace for defineTool call

// Ensure necessary types are still exported
// export type { EditFileToolInput, EditFileToolOutput, FileEditResult, EditResult, EditOperation }; // Removed duplicate export
