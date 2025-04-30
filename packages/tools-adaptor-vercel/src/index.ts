// Import ToolDefinition and rename it
import { type Part, type ToolDefinition as SylphToolDefinition, type ToolExecuteOptions, mapWhen, type BaseContextSchema } from '@sylphlab/tools-core';
import { z, type ZodTypeAny, type ZodUndefined, type ZodObject, type ZodRawShape } from 'zod'; // Import z and other Zod types
// Remove ToolResultContent import as it's not exported by 'ai'
import { tool as vercelToolHelper, type Tool as VercelTool } from 'ai'; // Rename helper

// Update function signature to use ToolDefinition and context schema generic
export function toVercelTool<
    TInputSchema extends ZodTypeAny = ZodUndefined,
    TContextSchema extends ZodTypeAny = typeof BaseContextSchema // Add context schema generic
>(
    tool: SylphToolDefinition<TInputSchema, TContextSchema>, // Use ToolDefinition
    options: ToolExecuteOptions // Base options are passed in
// Vercel's Tool type expects the execute result type as the second generic argument.
// Our original execute returns Part[], so we use that here for the mapping function.
): VercelTool<TInputSchema, Part[]> {
    const { description, inputSchema, execute, contextSchema } = tool; // Destructure contextSchema

    // Vercel's `tool` helper expects a ZodObject for parameters.
    // If the input schema is primitive, wrap it.
    const parametersSchema = inputSchema instanceof z.ZodObject
        ? inputSchema
        : z.object({ value: inputSchema });

    // The execute function provided to Vercel's helper must match its expected signature:
    // (args: TInputSchema) => Promise<Output>
    // Our Sylph tool execute is: ({ context, args }) => Promise<Part[]>
    // The Vercel execute wrapper needs to bridge this and return the original Part[] for mapping.
    const vercelExecute = async (vercelArgs: z.infer<typeof parametersSchema>): Promise<Part[]> => {
        try {
            // If the original input schema was primitive, extract the value from vercelArgs.value
            const executionArgs = inputSchema instanceof z.ZodObject ? vercelArgs : (vercelArgs as { value: any }).value;

            // Pass the provided options as the context.
            const executionContext = options;

            // Call the Sylph tool's execute with the expected structure
            const resultParts = await execute({ context: executionContext, args: executionArgs });

            // Return the original Part[] array for experimental_toToolResultContent to handle
            return resultParts;
        } catch (error) {
            console.error(`Error executing tool ${tool.name}:`, error);
            // Re-throw error to be handled by Vercel SDK or calling code
            throw error;
        }
    };

    // The experimental_toToolResultContent function maps the Part[] result from execute
    // to the format Vercel expects for displaying tool results.
    // Use 'any' as return type since ToolResultContent is not exported
    const experimental_toToolResultContent = (result: Part[]): any => {
         return mapWhen(result, {
           text: (part) => ({ type: 'text' as const, text: part.value }),
           json: (part) => ({ type: 'text' as const, text: JSON.stringify(part.value, null, 2) }), // Pretty print JSON here
           image: (part) => part, // Pass image through
           audio: (part) => ({ type: 'text' as const, text: `Audio file: ${part.data}` }), // Represent audio as text
           fileRef: (part) => ({ type: 'text' as const, text: `File reference: ${part.path}` }), // Represent fileRef as text
         });
    };

    // Use Vercel's tool helper
    const vercelToolInstance = vercelToolHelper({
        description,
        parameters: parametersSchema,
        execute: vercelExecute,
        experimental_toToolResultContent,
    });

    // Cast the return type to match the function signature
    return vercelToolInstance as VercelTool<TInputSchema, Part[]>;
}

// Import ToolDefinition here for use in the function signature
import type { ToolDefinition } from '@sylphlab/tools-core';

// Update function signature to use ToolDefinition and allow mixed schemas
export function toVercelTools(
    tools: ToolDefinition<any, any>[], // Use ToolDefinition<any, any>
    options: ToolExecuteOptions
// Adjust return type based on Vercel's Tool type and our wrapper's return type
): VercelTool<any, Part[]>[] { // Return type should match the individual tool return type
    // No need for generics here as we use <any, any>
    return tools.map(tool => toVercelTool(tool, options));
}