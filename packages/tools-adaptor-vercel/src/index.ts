import { type Part, type Tool as SylphTool, type ToolExecuteOptions, mapWhen } from '@sylphlab/tools-core';
import type { ZodTypeAny, ZodUndefined } from 'zod';
import { tool as vercelTool, type Tool as VercelTool } from 'ai';

export function toVercelTool<TInputSchema extends ZodTypeAny = ZodUndefined>(tool: SylphTool<TInputSchema>, options: ToolExecuteOptions) : VercelTool<TInputSchema, Part[]> {
    const { description, inputSchema, execute } = tool;
    const test =  vercelTool({
        description,
        parameters: inputSchema,
        execute: (args) => {
          return execute(args, options);
        },
        experimental_toToolResultContent(result) {
            const mapped = mapWhen(result, {
              text: (part) => ({
                type: 'text' as const,
                text: part.value,
              }),
              json: (part) => ({
                type: 'text' as const,
                text: JSON.stringify(part.value, null, 2),
              }),
              image: (part) => part,
              audio: (part) => ({
                type: 'text' as const,
                text: `Audio file: ${part.data}`,
              }),
              fileRef: (part) => ({
                type: 'text' as const,
                text: `File reference: ${part.path}`,
              }),
            });
            return mapped;
        }
    });
    return test;
}

export function toVercelTools<TInputSchema extends ZodTypeAny = ZodUndefined>(tools: SylphTool<TInputSchema>[], options: ToolExecuteOptions) : VercelTool<TInputSchema, Part[]>[] {
    return tools.map(tool => toVercelTool(tool, options));
}