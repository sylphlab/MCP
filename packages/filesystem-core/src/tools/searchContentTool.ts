import { readFile } from 'node:fs/promises';
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
import glob from 'fast-glob'; // Import fast-glob
import type { z } from 'zod';
import { searchContentToolInputSchema } from './searchContentTool.schema.js'; // Import schema (added .js)

// Infer the TypeScript type from the Zod schema
export type SearchContentToolInput = z.infer<typeof searchContentToolInputSchema>;

// --- Output Types ---
export interface SearchMatch {
  /** 1-based line number where the match occurred. */
  lineNumber: number;
  /** The full content of the line containing the match. */
  lineContent: string;
  /** The specific text that matched the query. */
  matchText: string;
  /** Lines immediately preceding the match line. */
  contextBefore?: string[];
  /** Lines immediately following the match line. */
  contextAfter?: string[];
}

export interface FileSearchResult {
  /** The file path searched (relative to workspace root). */
  path: string;
  /** Whether the search operation for this specific file was successful (even if no matches found). */
  success: boolean;
  /** Array of matches found in this file. */
  matches?: SearchMatch[];
  /** Optional error message if processing failed for this file. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Extend the base output type
export interface SearchContentToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true only if ALL matched files were searched successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each file searched. */
  results: FileSearchResult[];
}

// --- Tool Definition using defineTool ---

export const searchContentTool = defineTool({
  name: 'searchContentTool',
  description: 'Searches for content within multiple files (supports globs).',
  inputSchema: searchContentToolInputSchema,

  execute: async ( // Core logic passed to defineTool
    input: SearchContentToolInput,
    options: McpToolExecuteOptions,
  ): Promise<SearchContentToolOutput> => { // Still returns the specific output type

    // Zod validation (throw error on failure)
    const parsed = searchContentToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const {
      paths: pathPatterns, query, isRegex, matchCase, contextLinesBefore, contextLinesAfter, maxResultsPerFile,
    } = parsed.data;

    const fileResults: FileSearchResult[] = [];
    let overallSuccess = true; // Assume success until a failure occurs
    let resolvedFilePaths: string[] = [];

    // Keep try/catch for glob errors
    try {
      resolvedFilePaths = await glob(pathPatterns, {
        cwd: options.workspaceRoot, absolute: false, onlyFiles: true, dot: true, ignore: ['**/node_modules/**', '**/.git/**'],
      });
      if (resolvedFilePaths.length === 0) {
        // No files matched is not an error
        return { success: true, results: [], content: [] };
      }
    } catch (globError: unknown) {
      // If glob itself fails, throw an error for defineTool to catch
      const errorMsg = globError instanceof Error ? globError.message : 'Unknown glob error';
      throw new Error(`Glob pattern error: ${errorMsg}`);
    }

    // Removed the outermost try/catch block for file processing loop

    for (const relativeFilePath of resolvedFilePaths) {
      const fullPath = path.resolve(options.workspaceRoot, relativeFilePath);
      let fileSuccess = true;
      let fileError: string | undefined;
      const matches: SearchMatch[] = [];
      let suggestion: string | undefined;

      // --- Path Validation (Keep this check) ---
      const relativeCheck = path.relative(options.workspaceRoot, fullPath);
      if (
        !options?.allowOutsideWorkspace &&
        (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck))
      ) {
        fileError = `Path validation failed: Matched file '${relativeFilePath}' is outside workspace root.`;
        suggestion = `Ensure the path pattern '${pathPatterns.join(', ')}' does not resolve to paths outside the workspace.`;
        fileSuccess = false;
        overallSuccess = false;
        fileResults.push({ path: relativeFilePath, success: false, error: fileError, suggestion });
        continue; // Skip this file
      }
      // --- End Path Validation ---

      // Keep try/catch for individual file processing errors
      try {
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        let fileMatchCount = 0;

        // Prepare search query/regex
        let searchRegex: RegExp;
        if (isRegex) {
          try { // Keep try/catch for regex compilation
            const flags = matchCase ? 'g' : 'gi';
            searchRegex = new RegExp(query, flags);
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown regex error';
            throw new Error(`Invalid regex query: ${errorMsg}`); // Throw for file processing catch
          }
        } else {
          const flags = matchCase ? 'g' : 'gi';
          searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        }

        // Search lines... (logic remains the same)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line === undefined) continue;
          let matchResult: RegExpExecArray | null;
          searchRegex.lastIndex = 0; // Reset lastIndex for each line

          for (;;) {
            matchResult = searchRegex.exec(line);
            if (matchResult === null) break;
            if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) break;

            const matchText = matchResult[0];
            const lineNumber = i + 1;
            const contextBefore = lines.slice(Math.max(0, i - contextLinesBefore), i);
            const contextAfter = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLinesAfter));

            matches.push({
              lineNumber, lineContent: line, matchText,
              contextBefore: contextLinesBefore > 0 ? contextBefore : undefined,
              contextAfter: contextLinesAfter > 0 ? contextAfter : undefined,
            });
            fileMatchCount++;

            if (matchResult.index === searchRegex.lastIndex && searchRegex.global) {
              searchRegex.lastIndex++; // Prevent infinite loop for zero-length matches
            }
            if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) break;
          }
          if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) break;
        } // End line loop

      } catch (e: unknown) {
        // Handle file read or regex compilation errors
        fileSuccess = false;
        overallSuccess = false;
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
          suggestion = `Check read permissions for the file '${relativeFilePath}'.`;
        } else if (errorMsg.includes('Invalid regex')) {
          suggestion = 'Verify the regex query syntax.';
        } else {
          suggestion = 'Check file path and permissions.';
        }
      }

      // Push result for this file
      if (fileSuccess) {
        fileResults.push({
          path: relativeFilePath, success: true, matches: matches.length > 0 ? matches : undefined,
        });
      } else {
        fileResults.push({
          path: relativeFilePath, success: false, error: fileError, suggestion: suggestion,
        });
      }
    } // End files loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify(
      {
        summary: `Search operation completed. Overall success: ${overallSuccess}`,
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
  },
});

// Ensure necessary types are still exported
// export type { SearchContentToolInput, SearchContentToolOutput, FileSearchResult, SearchMatch }; // Removed duplicate export
