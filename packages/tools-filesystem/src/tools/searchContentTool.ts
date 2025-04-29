import { readFile } from 'node:fs/promises';
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
import { searchContentToolInputSchema } from './searchContentTool.schema.js';

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

// Zod Schema for SearchMatch
const SearchMatchSchema = z.object({
  lineNumber: z.number(),
  lineContent: z.string(),
  matchText: z.string(),
  contextBefore: z.array(z.string()).optional(),
  contextAfter: z.array(z.string()).optional(),
});

// Zod Schema for FileSearchResult
const FileSearchResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  matches: z.array(SearchMatchSchema).optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant
const SearchContentOutputSchema = z.array(FileSearchResultSchema);

// --- Tool Definition using defineTool ---

import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

export const searchContentTool = defineTool({
  name: 'search-content',
  description: 'Searches for content within multiple files (supports globs).',
  inputSchema: searchContentToolInputSchema,
  contextSchema: BaseContextSchema, // Add context schema

  execute: async (
    // Use new signature with destructuring
    { context, args }: { context: ToolExecuteOptions; args: SearchContentToolInput }
  ): Promise<Part[]> => {
    // Zod validation (throw error on failure)
    const parsed = searchContentToolInputSchema.safeParse(args); // Validate args
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    // Destructure all input properties from parsed args
    const {
      paths: pathPatterns,
      query,
      isRegex,
      matchCase,
      contextLinesBefore,
      contextLinesAfter,
      maxResultsPerFile,
    } = parsed.data;

    const fileResults: FileSearchResult[] = [];
    let resolvedFilePaths: string[] = [];

    // Keep try/catch for glob errors
    try {
      resolvedFilePaths = await glob(pathPatterns, {
        cwd: context.workspaceRoot, // Use context
        absolute: false,
        onlyFiles: true,
        dot: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });
      if (resolvedFilePaths.length === 0) {
        // No files matched is not an error, return empty results
        return [
          jsonPart([], SearchContentOutputSchema),
          textPart('No files matched the provided patterns.'),
        ];
      }
    } catch (globError: unknown) {
      const errorMsg = globError instanceof Error ? globError.message : 'Unknown glob error';
      throw new Error(`Glob pattern error: ${errorMsg}`);
    }

    for (const relativeFilePath of resolvedFilePaths) {
      const fullPath = path.resolve(context.workspaceRoot, relativeFilePath); // Use context
      let fileSuccess = true;
      let fileError: string | undefined;
      const matches: SearchMatch[] = [];
      let suggestion: string | undefined;

      // --- Path Validation ---
      const relativeCheck = path.relative(context.workspaceRoot, fullPath); // Use context
      if (
        !context?.allowOutsideWorkspace && // Use context
        (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck))
      ) {
        fileError = `Path validation failed: Matched file '${relativeFilePath}' is outside workspace root.`;
        suggestion = `Ensure the path pattern '${pathPatterns.join(', ')}' does not resolve to paths outside the workspace.`;
        fileSuccess = false;
        fileResults.push({ path: relativeFilePath, success: false, error: fileError, suggestion });
        continue; // Skip this file
      }
      // --- End Path Validation ---

      try {
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        let fileMatchCount = 0;

        // Prepare search query/regex
        let searchRegex: RegExp;
        if (isRegex) {
          try {
            const flags = matchCase ? 'g' : 'gi';
            searchRegex = new RegExp(query, flags);
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown regex error';
            throw new Error(`Invalid regex query: ${errorMsg}`);
          }
        } else {
          // Escape special characters for literal search
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const flags = matchCase ? 'g' : 'gi';
          searchRegex = new RegExp(escapedQuery, flags);
        }

        // Search lines
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line === undefined) continue; // Should not happen with split, but safety check
          let matchResult: RegExpExecArray | null;
          searchRegex.lastIndex = 0; // Reset lastIndex for each line

          while (true) {
            matchResult = searchRegex.exec(line);
            if (matchResult === null) {
              break; // Exit loop if no more matches
            }
            if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) break;

            const matchText = matchResult[0];
            const lineNumber = i + 1;
            const contextBefore = lines.slice(Math.max(0, i - contextLinesBefore), i);
            const contextAfter = lines.slice(
              i + 1,
              Math.min(lines.length, i + 1 + contextLinesAfter),
            );

            matches.push({
              lineNumber,
              lineContent: line,
              matchText,
              contextBefore: contextLinesBefore > 0 ? contextBefore : undefined,
              contextAfter: contextLinesAfter > 0 ? contextAfter : undefined,
            });
            fileMatchCount++;

            // Prevent infinite loop for zero-length matches with global flag
            if (matchResult.index === searchRegex.lastIndex && searchRegex.global) {
              searchRegex.lastIndex++;
            }
          }
          if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) break; // Break outer loop too
        } // End line loop
      } catch (e: unknown) {
        // Handle file read or regex compilation errors
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
          suggestion = `Check read permissions for the file '${relativeFilePath}'.`;
        } else if (errorMsg.includes('Invalid regex')) {
          suggestion = 'Verify the regex query syntax.';
        } else {
          suggestion = 'Check file path and permissions.';
        }
      }

      // Push result for this file (always, including errors or no matches)
      fileResults.push({
        path: relativeFilePath,
        success: fileSuccess,
        matches: fileSuccess && matches.length > 0 ? matches : undefined,
        error: fileError,
        suggestion: suggestion,
      });
    } // End files loop

    // Construct parts array
    const finalParts: Part[] = [
      jsonPart(fileResults, SearchContentOutputSchema),
      textPart(
        `Search operation attempted for ${resolvedFilePaths.length} matched file(s). ${fileResults.filter((r) => r.success).length} processed successfully.`,
      ), // Added summary
    ];

    // Return the parts array directly
    return finalParts;
  },
});
