import { Stats } from 'node:fs';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
export declare const StatItemsToolInputSchema: z.ZodObject<{
    paths: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    paths: string[];
}, {
    paths: string[];
}>;
export type StatItemsToolInput = z.infer<typeof StatItemsToolInputSchema>;
export interface StatItemResult {
    path: string;
    success: boolean;
    stat?: Stats;
    error?: string;
    suggestion?: string;
}
export interface StatItemsToolOutput extends BaseMcpToolOutput {
    error?: string;
    results: StatItemResult[];
}
export declare const statItemsTool: McpTool<typeof StatItemsToolInputSchema, StatItemsToolOutput>;
//# sourceMappingURL=statItemsTool.d.ts.map