import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import glob from 'fast-glob'; // Import fast-glob
import { McpTool, BaseMcpToolOutput, McpToolInput, validateAndResolvePath, PathValidationError, McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import base types and validation util
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

// --- Tool Definition (following SDK pattern) ---

export const searchContentTool: McpTool<typeof searchContentToolInputSchema, SearchContentToolOutput> = {
  name: 'searchContentTool',
  description: 'Searches for content within multiple files (supports globs).',
  inputSchema: searchContentToolInputSchema,

  async execute(input: SearchContentToolInput, options: McpToolExecuteOptions): Promise<SearchContentToolOutput> { // Remove workspaceRoot, require options
    // Zod validation
    const parsed = searchContentToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      return {
        success: false,
        error: `Input validation failed: ${errorMessages}`,
        results: [], // Keep results for consistency
        content: [], // Add required content field
      };
    }
    const {
        paths: pathPatterns,
        query,
        isRegex,
        matchCase,
        contextLinesBefore,
        contextLinesAfter,
        maxResultsPerFile,
    } = parsed.data; // allowOutsideWorkspace comes from options
    // --- End Zod Validation ---

    const fileResults: FileSearchResult[] = [];
    let overallSuccess = true;
    let resolvedFilePaths: string[] = [];

     try {
        resolvedFilePaths = await glob(pathPatterns, {
            cwd: options.workspaceRoot, // Use options.workspaceRoot
            absolute: false,
            onlyFiles: true,
            dot: true,
            ignore: ['**/node_modules/**', '**/.git/**'],
        });

        if (resolvedFilePaths.length === 0) {
             console.error('No files matched the provided paths/globs.'); // Log to stderr
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
        const matches: SearchMatch[] = [];
        let suggestion: string | undefined;


        // Double-check security
        // Skip this check if allowOutsideWorkspace is true
        const relativeCheck = path.relative(options.workspaceRoot, fullPath); // Use options.workspaceRoot
        if (!options?.allowOutsideWorkspace && (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck))) {
            fileError = `Path validation failed: Matched file '${relativeFilePath}' is outside workspace root.`;
            console.error(fileError); // Keep error log
            fileSuccess = false;
            overallSuccess = false;
            const suggestion = `Ensure the path pattern '${pathPatterns.join(', ')}' does not resolve to paths outside the workspace.`;
            fileResults.push({ path: relativeFilePath, success: false, error: fileError, suggestion });
            continue; // Skip this file
        }

        try {
            const content = await readFile(fullPath, 'utf-8');
            const lines = content.split(/\r?\n/);
            let fileMatchCount = 0;

            // Prepare search query/regex
            let searchRegex: RegExp;
            let searchString: string | null = null;
            if (isRegex) {
                try {
                    // Add 'g' flag for multiple matches per line, respect case sensitivity via 'i' flag
                    const flags = matchCase ? 'g' : 'gi';
                    searchRegex = new RegExp(query, flags);
                } catch (e: any) {
                    throw new Error(`Invalid regex query: ${e.message}`);
                }
            } else {
                searchString = query;
                // Create regex for finding the string, respecting case sensitivity
                const flags = matchCase ? 'g' : 'gi';
                searchRegex = new RegExp(searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
            }

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line === undefined) continue; // Should not happen with split, but safety

                let matchResult: RegExpExecArray | null;
                let searchIndex = 0;

                // Find all matches on the current line
                while ((matchResult = searchRegex.exec(line)) !== null) {
                    if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) {
                        break; // Stop searching this file if max results reached
                    }

                    const matchText = matchResult[0];
                    const lineNumber = i + 1; // 1-based line number

                    // Get context lines
                    const contextBefore = lines.slice(Math.max(0, i - contextLinesBefore), i);
                    const contextAfter = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLinesAfter));

                    matches.push({
                        lineNumber,
                        lineContent: line,
                        matchText,
                        contextBefore: contextLinesBefore > 0 ? contextBefore : undefined,
                        contextAfter: contextLinesAfter > 0 ? contextAfter : undefined,
                    });
                    fileMatchCount++;

                    // Prevent infinite loops for zero-length matches with global flag
                    if (matchResult.index === searchRegex.lastIndex) {
                        searchRegex.lastIndex++;
                    }
                     // Break if max results reached after adding this match
                    if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) {
                        break;
                    }
                }
                 if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) {
                    break; // Stop searching lines in this file
                }
            } // End line loop

        } catch (e: any) {
            fileSuccess = false;
            overallSuccess = false;
            fileError = `Error processing file '${relativeFilePath}': ${e.message}`;
            console.error(fileError); // Keep original error log too
            // let suggestion: string | undefined; // Already declared above
            if (e.code === 'ENOENT') {
                suggestion = `Ensure the file path '${relativeFilePath}' is correct and the file exists.`; // Assign to outer suggestion
            } else if (e.code === 'EACCES') {
                suggestion = `Check read permissions for the file '${relativeFilePath}'.`; // Assign to outer suggestion
            } else if (e.message.includes('Invalid regex')) {
                 suggestion = 'Verify the regex query syntax.'; // Assign to outer suggestion
            } else {
                suggestion = `Check file path and permissions.`; // Assign to outer suggestion
            }
        }

        // Always push a result if the file was processed, regardless of matches
        if (fileSuccess) {
             fileResults.push({
                path: relativeFilePath,
                success: true,
                matches: matches.length > 0 ? matches : undefined, // Include matches only if found
                error: undefined,
                suggestion: undefined,
            });
        } else {
            // Push the error result if processing failed
             fileResults.push({
                path: relativeFilePath,
                success: false,
                matches: undefined,
                error: fileError,
                suggestion: suggestion, // Use suggestion populated during validation or catch block
            });
        }
    } // End files loop

    // Serialize the detailed results into the content field
    const contentText = JSON.stringify({
        summary: `Search operation completed. Overall success: ${overallSuccess}`,
        results: fileResults
    }, null, 2); // Pretty-print JSON

    return {
      success: overallSuccess,
      results: fileResults, // Keep original results field too
      content: [{ type: 'text', text: contentText }], // Put JSON string in content
    };
  },
};