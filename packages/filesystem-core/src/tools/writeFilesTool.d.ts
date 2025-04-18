import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
export declare const WriteFilesToolInputSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        content: string;
    }, {
        path: string;
        content: string;
    }>, "many">;
    encoding: z.ZodDefault<z.ZodOptional<z.ZodEnum<["utf-8", "base64"]>>>;
    append: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    items: {
        path: string;
        content: string;
    }[];
    encoding: "utf-8" | "base64";
    append: boolean;
}, {
    items: {
        path: string;
        content: string;
    }[];
    encoding?: "utf-8" | "base64" | undefined;
    append?: boolean | undefined;
}>;
export type WriteFilesToolInput = z.infer<typeof WriteFilesToolInputSchema>;
export interface WriteFileResult {
    path: string;
    success: boolean;
    message?: string;
    error?: string;
    suggestion?: string;
}
export interface WriteFilesToolOutput extends BaseMcpToolOutput {
    error?: string;
    results: WriteFileResult[];
}
export declare const writeFilesTool: McpTool<typeof WriteFilesToolInputSchema, WriteFilesToolOutput>;
//# sourceMappingURL=writeFilesTool.d.ts.map