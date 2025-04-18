import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
export declare const DeleteItemsToolInputSchema: z.ZodObject<{
    paths: z.ZodArray<z.ZodString, "many">;
    recursive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    useTrash: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    recursive: boolean;
    paths: string[];
    useTrash: boolean;
}, {
    paths: string[];
    recursive?: boolean | undefined;
    useTrash?: boolean | undefined;
}>;
export type DeleteItemsToolInput = z.infer<typeof DeleteItemsToolInputSchema>;
export interface DeleteItemResult {
    path: string;
    success: boolean;
    message?: string;
    error?: string;
    suggestion?: string;
}
export interface DeleteItemsToolOutput extends BaseMcpToolOutput {
    error?: string;
    results: DeleteItemResult[];
}
export declare const deleteItemsTool: McpTool<typeof DeleteItemsToolInputSchema, DeleteItemsToolOutput>;
//# sourceMappingURL=deleteItemsTool.d.ts.map