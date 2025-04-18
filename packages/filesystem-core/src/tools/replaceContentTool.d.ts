import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
declare const ReplaceOperationSchema: z.ZodEffects<z.ZodObject<{
    search: z.ZodString;
    replace: z.ZodString;
    isRegex: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    flags: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    search: string;
    replace: string;
    isRegex: boolean;
    flags?: string | undefined;
}, {
    search: string;
    replace: string;
    flags?: string | undefined;
    isRegex?: boolean | undefined;
}>, {
    search: string;
    replace: string;
    isRegex: boolean;
    flags?: string | undefined;
}, {
    search: string;
    replace: string;
    flags?: string | undefined;
    isRegex?: boolean | undefined;
}>;
export declare const ReplaceContentToolInputSchema: z.ZodObject<{
    paths: z.ZodArray<z.ZodString, "many">;
    operations: z.ZodArray<z.ZodEffects<z.ZodObject<{
        search: z.ZodString;
        replace: z.ZodString;
        isRegex: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        flags: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        search: string;
        replace: string;
        isRegex: boolean;
        flags?: string | undefined;
    }, {
        search: string;
        replace: string;
        flags?: string | undefined;
        isRegex?: boolean | undefined;
    }>, {
        search: string;
        replace: string;
        isRegex: boolean;
        flags?: string | undefined;
    }, {
        search: string;
        replace: string;
        flags?: string | undefined;
        isRegex?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    paths: string[];
    operations: {
        search: string;
        replace: string;
        isRegex: boolean;
        flags?: string | undefined;
    }[];
}, {
    paths: string[];
    operations: {
        search: string;
        replace: string;
        flags?: string | undefined;
        isRegex?: boolean | undefined;
    }[];
}>;
export type ReplaceContentToolInput = z.infer<typeof ReplaceContentToolInputSchema>;
export type ReplaceOperation = z.infer<typeof ReplaceOperationSchema>;
export interface FileReplaceResult {
    /** The file path processed (relative to workspace root). */
    path: string;
    /** Whether the replacement operations for this specific file were successful. */
    success: boolean;
    /** Number of replacements made in this file across all operations. */
    replacementsMade: number;
    /** True if the file content was actually changed and written back. */
    contentChanged: boolean;
    /** Optional error message if processing failed for this file. */
    error?: string;
    /** Optional suggestion for fixing the error. */
    suggestion?: string;
}
export interface ReplaceContentToolOutput extends BaseMcpToolOutput {
    /** Overall operation success (true only if ALL matched files processed successfully). */
    /** Optional general error message if the tool encountered a major issue. */
    error?: string;
    /** Array of results for each file processed. */
    results: FileReplaceResult[];
}
export declare const replaceContentTool: McpTool<typeof ReplaceContentToolInputSchema, ReplaceContentToolOutput>;
export {};
//# sourceMappingURL=replaceContentTool.d.ts.map