import { Stats } from 'node:fs';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
export declare const ListFilesToolInputSchema: z.ZodObject<{
    paths: z.ZodArray<z.ZodString, "many">;
    recursive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    maxDepth: z.ZodOptional<z.ZodNumber>;
    includeStats: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    recursive: boolean;
    paths: string[];
    includeStats: boolean;
    maxDepth?: number | undefined;
}, {
    paths: string[];
    recursive?: boolean | undefined;
    maxDepth?: number | undefined;
    includeStats?: boolean | undefined;
}>;
export type ListFilesToolInput = z.infer<typeof ListFilesToolInputSchema>;
export interface ListEntry {
    /** Name of the file or directory. */
    name: string;
    /** Relative path from the workspace root. */
    path: string;
    /** True if the entry is a directory. */
    isDirectory: boolean;
    /** True if the entry is a file. */
    isFile: boolean;
    /** Optional file system stats (if includeStats was true). */
    stat?: Stats;
}
export interface PathListResult {
    /** Whether listing was successful for this path. */
    success: boolean;
    /** Array of entries found within the path. */
    entries?: ListEntry[];
    /** Optional error message if listing failed for this path. */
    error?: string;
    /** Optional suggestion for fixing the error. */
    suggestion?: string;
}
export interface ListFilesToolOutput extends BaseMcpToolOutput {
    /** Overall operation success (true if at least one path was listed successfully). */
    /** Optional general error message if the tool encountered a major issue. */
    error?: string;
    /** Object where keys are the input paths and values are the listing results. */
    results: {
        [inputPath: string]: PathListResult;
    };
}
export declare const listFilesTool: McpTool<typeof ListFilesToolInputSchema, ListFilesToolOutput>;
//# sourceMappingURL=listFilesTool.d.ts.map