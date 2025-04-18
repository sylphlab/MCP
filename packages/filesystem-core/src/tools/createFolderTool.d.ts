import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
export declare const CreateFolderToolInputSchema: z.ZodObject<{
    folderPaths: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    folderPaths: string[];
}, {
    folderPaths: string[];
}>;
export type CreateFolderToolInput = z.infer<typeof CreateFolderToolInputSchema>;
export interface CreateFolderResult {
    path: string;
    success: boolean;
    message?: string;
    error?: string;
    suggestion?: string;
}
export interface CreateFolderToolOutput extends BaseMcpToolOutput {
    error?: string;
    results: CreateFolderResult[];
}
export declare const createFolderTool: McpTool<typeof CreateFolderToolInputSchema, CreateFolderToolOutput>;
//# sourceMappingURL=createFolderTool.d.ts.map