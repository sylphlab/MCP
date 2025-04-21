import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  type BaseMcpToolOutput,
  type McpTool,
  type McpToolExecuteOptions,
  McpToolInput,
  PathValidationError,
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

// --- Tool Definition (following SDK pattern) ---

export const editFileTool: McpTool<typeof editFileToolInputSchema, EditFileToolOutput> = {
  name: 'editFileTool',
  description:
    'Applies selective edits (insert, delete, replace by line or search pattern) to one or more files.',
  inputSchema: editFileToolInputSchema,

  async execute(
    input: EditFileToolInput,
    options: McpToolExecuteOptions,
  ): Promise<EditFileToolOutput> {
    // Remove workspaceRoot, require options
    // Zod validation
    const parsed = editFileToolInputSchema.safeParse(input);
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

    try {
      // Add top-level try block

      for (const change of changes) {
        const filePath = change.path;
        const editResults: EditResult[] = [];
        let fileSuccess = true;
        let fileError: string | undefined;
        let fileSuggestion: string | undefined;

        // --- Validate and Resolve Path ---
        const validationResult = validateAndResolvePath(
          filePath,
          options.workspaceRoot,
          options?.allowOutsideWorkspace,
        ); // Use options.workspaceRoot
        if (typeof validationResult !== 'string') {
          fileError = validationResult.error;
          fileSuggestion = validationResult.suggestion;
          fileSuccess = false;
          overallSuccess = false;
          fileResults.push({
            path: filePath,
            success: false,
            error: fileError,
            suggestion: fileSuggestion,
            edit_results: [],
          });
          continue;
        }
        const fullPath = validationResult;
        // --- End Path Validation ---

        try {
          // Read the file content
          const originalContent = await readFile(fullPath, 'utf-8');
          const lines = originalContent === '' ? [] : originalContent.split(/\r?\n/);
          // Handle potential trailing newline creating an empty last element
          if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
          }
          const currentLines = [...lines];

          for (const [index, edit] of change.edits.entries()) {
            let editSuccess = false;
            let editMessage: string | undefined;
            let editError: string | undefined;
            let suggestion: string | undefined;
            const currentLineCount = currentLines.length; // Recalculate before each edit

            try {
              const startLine = edit.start_line ?? 1; // Default start_line to 1 if omitted
              const startLineIndex = startLine - 1;

              // --- Start Line Boundary Check ---
              const maxStartIndex =
                edit.operation === 'insert' ? currentLineCount : Math.max(0, currentLineCount - 1);
              const maxStartLine =
                edit.operation === 'insert' ? currentLineCount + 1 : currentLineCount;
              if (startLineIndex < 0 || startLineIndex > maxStartIndex) {
                throw new Error(`start_line ${startLine} is out of bounds (1-${maxStartLine}).`);
              }
              // --- End Start Line Boundary Check ---

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
                  const endLine = edit.end_line; // Already validated by Zod to be >= start_line
                  const endLineIndex = endLine - 1;
                  if (endLineIndex < 0 || endLineIndex >= currentLineCount) {
                    throw new Error(
                      `end_line ${endLine} is out of bounds (1-${currentLineCount}).`,
                    );
                  }
                  const deleteCount = endLineIndex - startLineIndex + 1;
                  currentLines.splice(startLineIndex, deleteCount);
                  editMessage = `Deleted ${deleteCount} line(s) from line ${startLine}.`;
                  editSuccess = true;
                  break;
                }
                case 'replace_lines': {
                  const endLine = edit.end_line; // Already validated by Zod to be >= start_line
                  const endLineIndex = endLine - 1;
                  if (endLineIndex < 0 || endLineIndex >= currentLineCount) {
                    throw new Error(
                      `end_line ${endLine} is out of bounds (1-${currentLineCount}).`,
                    );
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
                  const endLine = edit.end_line ?? currentLineCount; // Default end_line to last line if omitted
                  const endLineIndex = endLine - 1;
                  if (endLineIndex < 0 || endLineIndex >= currentLineCount) {
                    throw new Error(
                      `end_line ${endLine} is out of bounds (1-${currentLineCount}).`,
                    );
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
                      // Schema only allows string replace, so no need to check for function
                      modifiedLine = originalLine.replace(regex, edit.replace);
                      // Count replacements based on non-overlapping matches
                      // This is an approximation; complex regex might behave differently
                      lineReplacements = (originalLine.match(regex) || []).length;
                    } else if (edit.operation === 'search_replace_text') {
                      const _searchStr = edit.search;
                      const _replaceStr = edit.replace;
                      // Use standard string replace for first occurrence only
                      modifiedLine = originalLine.replace(edit.search, edit.replace);
                      // Estimate replacements made for message consistency (crude)
                      if (originalLine !== modifiedLine) {
                        lineReplacements = 1; // Assume at least one if changed
                      }
                    } else {
                      modifiedLine = originalLine;
                    }

                    if (originalLine !== modifiedLine) {
                      currentLines[i] = modifiedLine;
                      replacementsMade += lineReplacements; // Count actual replacements
                    }
                  }
                  // Include replacement count in the message
                  editMessage = `${replacementsMade} replacement(s) made between lines ${startLine} and ${endLine}.`;
                  if (replacementsMade === 0) {
                    editMessage = `No replacements needed between lines ${startLine} and ${endLine}.`;
                  }
                  editSuccess = true;
                  break;
                }
              }
            } catch (e: unknown) {
              editSuccess = false;
              fileSuccess = false;
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

            editResults.push({
              editIndex: index,
              success: editSuccess,
              message: editMessage,
              error: editError,
              suggestion,
            });
            // if (!editSuccess) break; // Temporarily remove break
          }

          // If all edits for the file were successful (or no edits failed), write back
          if (fileSuccess) {
            // Compare content accurately, ignoring potential trailing newline differences for the check
            const modifiedContentJoined = currentLines.join('\n');
            // Remove potential single trailing newline from original content for comparison purposes ONLY
            const originalContentTrimmed = originalContent.replace(/\r?\n$/, '');

            if (modifiedContentJoined !== originalContentTrimmed) {
              // Write the joined content as is; fs.writeFile handles platform specifics
              await writeFile(fullPath, modifiedContentJoined, 'utf-8');
            } else {
            }
          } else {
            overallSuccess = false;
          }
        } catch (e: unknown) {
          // Catch errors during file read or edit loop
          fileSuccess = false;
          overallSuccess = false; // Mark overall as failed
          const errorMsg = e instanceof Error ? e.message : 'Unknown file processing error';
          fileError = `Error processing file '${filePath}': ${errorMsg}`;
          const suggestion = `Check if file '${filePath}' exists and if you have read/write permissions.`;
          if (editResults.length === 0) {
            change.edits.forEach((_editOp, index) => {
              editResults.push({
                editIndex: index,
                success: false,
                error: `File processing failed before edit: ${errorMsg}`, // Use extracted message
                suggestion,
              });
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
      // Serialize the detailed results into the content field
      const contentText = JSON.stringify(
        {
          summary: `Edit operation completed. Overall success: ${overallSuccess}`,
          results: fileResults,
        },
        null,
        2,
      ); // Pretty-print JSON

      return {
        success: overallSuccess,
        results: fileResults, // Keep original results field too
        content: [{ type: 'text', text: contentText }], // Put JSON string in content
      };
    } catch (unexpectedError: unknown) {
      // Catch unexpected errors during the main loop/setup
      // Return minimal error structure on unexpected failure
      const errorMsg =
        unexpectedError instanceof Error
          ? `Unexpected tool error: ${unexpectedError.message}`
          : 'Unexpected tool error: Unknown error';
      const errorContentText = JSON.stringify(
        {
          error: errorMsg,
          results: fileResults, // Include partial results if any
        },
        null,
        2,
      );
      return {
        success: false,
        error: errorMsg, // Keep top-level error
        results: fileResults, // Keep partial results here too
        content: [{ type: 'text', text: errorContentText }], // Put error JSON in content
      };
    }
  }, // Closing brace for execute method
}; // Closing brace for tool object
