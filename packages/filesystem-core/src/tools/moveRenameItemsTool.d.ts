import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
export declare const MoveRenameItemsToolInputSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        sourcePath: z.ZodString;
        destinationPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourcePath: string;
        destinationPath: string;
    }, {
        sourcePath: string;
        destinationPath: string;
    }>, "many">;
    overwrite: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    items: {
        sourcePath: string;
        destinationPath: string;
    }[];
    overwrite: boolean;
}, {
    items: {
        sourcePath: string;
        destinationPath: string;
    }[];
    overwrite?: boolean | undefined;
}>;
export type MoveRenameItemsToolInput = z.infer<typeof MoveRenameItemsToolInputSchema>;
export interface MoveRenameItemResult {
    /** The source path provided in the input. */
    sourcePath: string;
    /** The destination path provided in the input. */
    destinationPath: string;
    /** Whether the move/rename operation for this specific item was successful. */
    success: boolean;
    /** Optional message providing more details. */
    message?: string;
    /** Optional error message if the operation failed for this item. */
    error?: string;
    /** Optional suggestion for fixing the error. */
    suggestion?: string;
}
export interface MoveRenameItemsToolOutput extends BaseMcpToolOutput {
    /** Overall operation success (true only if ALL items moved/renamed successfully). */
    /** Optional general error message if the tool encountered a major issue. */
    error?: string;
    /** Array of results for each move/rename operation. */
    results: MoveRenameItemResult[];
}
export declare const moveRenameItemsTool: McpTool<typeof MoveRenameItemsToolInputSchema, MoveRenameItemsToolOutput>;
//# sourceMappingURL=moveRenameItemsTool.d.ts.map