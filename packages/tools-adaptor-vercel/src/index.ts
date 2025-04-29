// Import ToolDefinition and rename it
import { type Part, type ToolDefinition as SylphToolDefinition, type ToolExecuteOptions, mapWhen, type BaseContextSchema } from '@sylphlab/tools-core';
import type { ZodTypeAny, ZodUndefined } from 'zod';
import { tool as vercelTool, type Tool as VercelTool } from 'ai';

// Update function signature to use ToolDefinition and context schema generic
export function toVercelTool<
    TInputSchema extends ZodTypeAny = ZodUndefined,
    TContextSchema extends ZodTypeAny = typeof BaseContextSchema // Add context schema generic
>(
    tool: SylphToolDefinition<TInputSchema, TContextSchema>, // Use ToolDefinition
    options: ToolExecuteOptions // Base options are passed in
): VercelTool<TInputSchema, Part[]> {
    const { description, inputSchema, execute, contextSchema } = tool; // Destructure contextSchema
    const vercelToolInstance = vercelTool({ // Renamed variable for clarity
        description,
        parameters: inputSchema,
        // Vercel's execute expects (args), but our tool expects ({ context, args })
        execute: async (vercelArgs) => { // Receive Vercel's args object
          // Pass the provided 'options' as the context, and Vercel's args as 'args'
          // TODO: Consider validating/transforming options based on contextSchema
          const executionContext = options;
          // Call the Sylph tool's execute with the expected structure
          const sylphResult = await execute({ context: executionContext, args: vercelArgs });
          // Return the result (Vercel's vercelTool helper handles the experimental_toToolResultContent mapping)
          return sylphResult;
        },
        experimental_toToolResultContent(result) {
            // This mapping function remains the same
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
    return vercelToolInstance; // Return the renamed variable
}

// Update function signature to use ToolDefinition
export function toVercelTools<
    TInputSchema extends ZodTypeAny = ZodUndefined,
    TContextSchema extends ZodTypeAny = typeof BaseContextSchema
>(
    tools: SylphToolDefinition<TInputSchema, TContextSchema>[], // Use ToolDefinition
    options: ToolExecuteOptions
): VercelTool<TInputSchema, Part[]>[] {
    // Pass generics to toVercelTool call
    return tools.map(tool => toVercelTool<TInputSchema, TContextSchema>(tool, options));
}