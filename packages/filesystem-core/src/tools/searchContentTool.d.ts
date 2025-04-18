import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
export declare const SearchContentToolInputSchema: z.ZodObject<{
    paths: z.ZodArray<z.ZodString, "many">;
    query: z.ZodString;
    isRegex: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    matchCase: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    contextLinesBefore: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    contextLinesAfter: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxResultsPerFile: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    paths: string[];
    isRegex: boolean;
    query: string;
    matchCase: boolean;
    contextLinesBefore: number;
    contextLinesAfter: number;
    maxResultsPerFile?: number | undefined;
}, {
    paths: string[];
    query: string;
    isRegex?: boolean | undefined;
    matchCase?: boolean | undefined;
    contextLinesBefore?: number | undefined;
    contextLinesAfter?: number | undefined;
    maxResultsPerFile?: number | undefined;
}>;
export type SearchContentToolInput = z.infer<typeof SearchContentToolInputSchema>;
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
export interface SearchContentToolOutput extends BaseMcpToolOutput {
    /** Overall operation success (true only if ALL matched files were searched successfully). */
    /** Optional general error message if the tool encountered a major issue. */
    error?: string;
    /** Array of results for each file searched. */
    results: FileSearchResult[];
}
export declare const searchContentTool: McpTool<typeof SearchContentToolInputSchema, SearchContentToolOutput>;
//# sourceMappingURL=searchContentTool.d.ts.map