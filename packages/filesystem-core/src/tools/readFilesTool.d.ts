import { Stats } from 'node:fs';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
export declare const ReadFilesToolInputSchema: z.ZodObject<{
    paths: z.ZodArray<z.ZodString, "many">;
    encoding: z.ZodDefault<z.ZodOptional<z.ZodEnum<["utf-8", "base64"]>>>;
    includeStats: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    paths: string[];
    includeStats: boolean;
    encoding: "utf-8" | "base64";
}, {
    paths: string[];
    includeStats?: boolean | undefined;
    encoding?: "utf-8" | "base64" | undefined;
}>;
export type ReadFilesToolInput = z.infer<typeof ReadFilesToolInputSchema>;
export interface ReadFileResult {
    /** The file path provided in the input. */
    path: string;
    /** Whether the read operation for this specific file was successful. */
    success: boolean;
    /** The content of the file, as a string (respecting encoding). */
    content?: string;
    /** Optional file system stats (if includeStats was true). */
    stat?: Stats;
    /** Optional error message if the operation failed for this file. */
    error?: string;
    /** Optional suggestion for fixing the error. */
    suggestion?: string;
}
export interface ReadFilesToolOutput extends BaseMcpToolOutput {
    /** Overall operation success (true if at least one file was read successfully). */
    /** Optional general error message if the tool encountered a major issue. */
    error?: string;
    /** Array of results for each file read operation. */
    results: ReadFileResult[];
}
export declare const readFilesTool: McpTool<typeof ReadFilesToolInputSchema, ReadFilesToolOutput>;
//# sourceMappingURL=readFilesTool.d.ts.map