import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import glob from 'fast-glob'; // Import fast-glob
import { McpTool, BaseMcpToolOutput, McpToolInput } from '@sylphlab/mcp-core'; // Import base types

// --- Zod Schema for Input Validation ---
export const SearchContentToolInputSchema = z.object({
  paths: z.array(
      z.string({ required_error: 'Each path/glob must be a string' })
       .min(1, 'Path/glob cannot be empty')
    )
    .min(1, 'paths array cannot be empty'),
  query: z.string().min(1, 'query cannot be empty'),
  isRegex: z.boolean().optional().default(false),
  matchCase: z.boolean().optional().default(true), // Default to case-sensitive
  contextLinesBefore: z.number().int().min(0).optional().default(0),
  contextLinesAfter: z.number().int().min(0).optional().default(0),
  maxResultsPerFile: z.number().int().min(1).optional(),
});
// Removed refine check causing issues with isRegex:true and matchCase:true


// Infer the TypeScript type from the Zod schema
export type SearchContentToolInput = z.infer<typeof SearchContentToolInputSchema>;

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

export const searchContentTool: McpTool<typeof SearchContentToolInputSchema, SearchContentToolOutput> = {
  name: 'searchContentTool',
  description: 'Searches for content within multiple files (supports globs).',
  inputSchema: SearchContentToolInputSchema,

  async execute(input: SearchContentToolInput, workspaceRoot: string): Promise<SearchContentToolOutput> {
    // Zod validation
    const parsed = SearchContentToolInputSchema.safeParse(input);
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
    } = parsed.data;
    // --- End Zod Validation ---

    const fileResults: FileSearchResult[] = [];
    let overallSuccess = true;
    let resolvedFilePaths: string[] = [];

     try {
        resolvedFilePaths = await glob(pathPatterns, {
            cwd: workspaceRoot,
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
        const fullPath = path.resolve(workspaceRoot, relativeFilePath);
        let fileSuccess = true;
        let fileError: string | undefined;
        const matches: SearchMatch[] = [];

        // Double-check security
        const relativeCheck = path.relative(workspaceRoot, fullPath);
         if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
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
            let suggestion: string | undefined;
            if (e.code === 'ENOENT') {
                suggestion = `Ensure the file path '${relativeFilePath}' is correct and the file exists.`;
            } else if (e.code === 'EACCES') {
                suggestion = `Check read permissions for the file '${relativeFilePath}'.`;
            } else if (e.message.includes('Invalid regex')) {
                 suggestion = 'Verify the regex query syntax.';
            } else {
                suggestion = `Check file path and permissions.`;
            }
            // Assign suggestion to the result object later
        }

        fileResults.push({
            path: relativeFilePath,
            success: fileSuccess,
            matches: matches.length > 0 ? matches : undefined, // Only include matches array if not empty
            error: fileError,
            suggestion: !fileSuccess ? (fileResults.find(r => r.path === relativeFilePath)?.suggestion ?? `Check file path and permissions.`) : undefined,
        });
    } // End files loop

    return {
      success: overallSuccess,
      results: fileResults,
      // Add a default success message to content if overall successful
      content: overallSuccess
        ? [{ type: 'text', text: `Search operation completed. Success: ${overallSuccess}` }]
        : [],
    };
  },
};