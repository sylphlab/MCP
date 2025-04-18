import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
declare const EditOperationSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"operation", [z.ZodObject<{
    operation: z.ZodLiteral<"insert">;
    start_line: z.ZodNumber;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    operation: "insert";
    start_line: number;
}, {
    content: string;
    operation: "insert";
    start_line: number;
}>, z.ZodObject<{
    operation: z.ZodLiteral<"delete_lines">;
    start_line: z.ZodNumber;
    end_line: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    operation: "delete_lines";
    start_line: number;
    end_line: number;
}, {
    operation: "delete_lines";
    start_line: number;
    end_line: number;
}>, z.ZodObject<{
    operation: z.ZodLiteral<"replace_lines">;
    start_line: z.ZodNumber;
    end_line: z.ZodNumber;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    operation: "replace_lines";
    start_line: number;
    end_line: number;
}, {
    content: string;
    operation: "replace_lines";
    start_line: number;
    end_line: number;
}>, z.ZodObject<{
    operation: z.ZodLiteral<"search_replace_text">;
    search: z.ZodString;
    replace: z.ZodString;
    start_line: z.ZodOptional<z.ZodNumber>;
    end_line: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    operation: "search_replace_text";
    search: string;
    replace: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
}, {
    operation: "search_replace_text";
    search: string;
    replace: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
}>, z.ZodObject<{
    operation: z.ZodLiteral<"search_replace_regex">;
    regex: z.ZodString;
    replace: z.ZodString;
    flags: z.ZodOptional<z.ZodString>;
    start_line: z.ZodOptional<z.ZodNumber>;
    end_line: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    operation: "search_replace_regex";
    replace: string;
    regex: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
    flags?: string | undefined;
}, {
    operation: "search_replace_regex";
    replace: string;
    regex: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
    flags?: string | undefined;
}>]>, {
    content: string;
    operation: "insert";
    start_line: number;
} | {
    operation: "delete_lines";
    start_line: number;
    end_line: number;
} | {
    content: string;
    operation: "replace_lines";
    start_line: number;
    end_line: number;
} | {
    operation: "search_replace_text";
    search: string;
    replace: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
} | {
    operation: "search_replace_regex";
    replace: string;
    regex: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
    flags?: string | undefined;
}, {
    content: string;
    operation: "insert";
    start_line: number;
} | {
    operation: "delete_lines";
    start_line: number;
    end_line: number;
} | {
    content: string;
    operation: "replace_lines";
    start_line: number;
    end_line: number;
} | {
    operation: "search_replace_text";
    search: string;
    replace: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
} | {
    operation: "search_replace_regex";
    replace: string;
    regex: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
    flags?: string | undefined;
}>;
export declare const EditFileToolInputSchema: z.ZodObject<{
    changes: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        edits: z.ZodArray<z.ZodEffects<z.ZodDiscriminatedUnion<"operation", [z.ZodObject<{
            operation: z.ZodLiteral<"insert">;
            start_line: z.ZodNumber;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            content: string;
            operation: "insert";
            start_line: number;
        }, {
            content: string;
            operation: "insert";
            start_line: number;
        }>, z.ZodObject<{
            operation: z.ZodLiteral<"delete_lines">;
            start_line: z.ZodNumber;
            end_line: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            operation: "delete_lines";
            start_line: number;
            end_line: number;
        }, {
            operation: "delete_lines";
            start_line: number;
            end_line: number;
        }>, z.ZodObject<{
            operation: z.ZodLiteral<"replace_lines">;
            start_line: z.ZodNumber;
            end_line: z.ZodNumber;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            content: string;
            operation: "replace_lines";
            start_line: number;
            end_line: number;
        }, {
            content: string;
            operation: "replace_lines";
            start_line: number;
            end_line: number;
        }>, z.ZodObject<{
            operation: z.ZodLiteral<"search_replace_text">;
            search: z.ZodString;
            replace: z.ZodString;
            start_line: z.ZodOptional<z.ZodNumber>;
            end_line: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            operation: "search_replace_text";
            search: string;
            replace: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
        }, {
            operation: "search_replace_text";
            search: string;
            replace: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
        }>, z.ZodObject<{
            operation: z.ZodLiteral<"search_replace_regex">;
            regex: z.ZodString;
            replace: z.ZodString;
            flags: z.ZodOptional<z.ZodString>;
            start_line: z.ZodOptional<z.ZodNumber>;
            end_line: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            operation: "search_replace_regex";
            replace: string;
            regex: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
            flags?: string | undefined;
        }, {
            operation: "search_replace_regex";
            replace: string;
            regex: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
            flags?: string | undefined;
        }>]>, {
            content: string;
            operation: "insert";
            start_line: number;
        } | {
            operation: "delete_lines";
            start_line: number;
            end_line: number;
        } | {
            content: string;
            operation: "replace_lines";
            start_line: number;
            end_line: number;
        } | {
            operation: "search_replace_text";
            search: string;
            replace: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
        } | {
            operation: "search_replace_regex";
            replace: string;
            regex: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
            flags?: string | undefined;
        }, {
            content: string;
            operation: "insert";
            start_line: number;
        } | {
            operation: "delete_lines";
            start_line: number;
            end_line: number;
        } | {
            content: string;
            operation: "replace_lines";
            start_line: number;
            end_line: number;
        } | {
            operation: "search_replace_text";
            search: string;
            replace: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
        } | {
            operation: "search_replace_regex";
            replace: string;
            regex: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
            flags?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        path: string;
        edits: ({
            content: string;
            operation: "insert";
            start_line: number;
        } | {
            operation: "delete_lines";
            start_line: number;
            end_line: number;
        } | {
            content: string;
            operation: "replace_lines";
            start_line: number;
            end_line: number;
        } | {
            operation: "search_replace_text";
            search: string;
            replace: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
        } | {
            operation: "search_replace_regex";
            replace: string;
            regex: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
            flags?: string | undefined;
        })[];
    }, {
        path: string;
        edits: ({
            content: string;
            operation: "insert";
            start_line: number;
        } | {
            operation: "delete_lines";
            start_line: number;
            end_line: number;
        } | {
            content: string;
            operation: "replace_lines";
            start_line: number;
            end_line: number;
        } | {
            operation: "search_replace_text";
            search: string;
            replace: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
        } | {
            operation: "search_replace_regex";
            replace: string;
            regex: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
            flags?: string | undefined;
        })[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    changes: {
        path: string;
        edits: ({
            content: string;
            operation: "insert";
            start_line: number;
        } | {
            operation: "delete_lines";
            start_line: number;
            end_line: number;
        } | {
            content: string;
            operation: "replace_lines";
            start_line: number;
            end_line: number;
        } | {
            operation: "search_replace_text";
            search: string;
            replace: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
        } | {
            operation: "search_replace_regex";
            replace: string;
            regex: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
            flags?: string | undefined;
        })[];
    }[];
}, {
    changes: {
        path: string;
        edits: ({
            content: string;
            operation: "insert";
            start_line: number;
        } | {
            operation: "delete_lines";
            start_line: number;
            end_line: number;
        } | {
            content: string;
            operation: "replace_lines";
            start_line: number;
            end_line: number;
        } | {
            operation: "search_replace_text";
            search: string;
            replace: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
        } | {
            operation: "search_replace_regex";
            replace: string;
            regex: string;
            start_line?: number | undefined;
            end_line?: number | undefined;
            flags?: string | undefined;
        })[];
    }[];
}>;
export type EditFileToolInput = z.infer<typeof EditFileToolInputSchema>;
export type EditOperation = z.infer<typeof EditOperationSchema>;
export interface EditResult {
    /** Index of the edit operation in the input array. */
    editIndex: number;
    /** Whether this specific edit was applied successfully. */
    success: boolean;
    /** Optional message (e.g., "Inserted content", "Replaced 3 occurrences"). */
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
export interface EditFileToolOutput extends BaseMcpToolOutput {
    /** Overall operation success (true only if ALL file changes were fully successful). */
    /** Optional general error message if the tool encountered a major issue. */
    error?: string;
    /** Array of results for each file change operation. */
    results: FileEditResult[];
}
export declare const editFileTool: McpTool<typeof EditFileToolInputSchema, EditFileToolOutput>;
export {};
//# sourceMappingURL=editFileTool.d.ts.map