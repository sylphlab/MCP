import type { ZodTypeAny, z } from 'zod'; // Use import type
import type {
  ToolExecuteOptions,
  Part,
  BaseContextSchema, // Import BaseContextSchema
} from './index';
// Assuming checkOutputSizeLimit is correctly exported from utils
// Adjust the import path if utils is structured differently or not directly accessible
// If utils is not a direct dependency of core, this helper might need to move to core
// or be passed in somehow. For now, assume it can be imported.
// import { checkOutputSizeLimit } from './outputUtils.js'; // Removed - Size check moved to Adapter/Server layer


/**
 * Defines the structure required to define a tool using the defineTool helper.
 * The context type is inferred from the provided contextSchema.
 * @template TInputSchema Zod schema for input validation.
 * @template TContextSchema Zod schema for context validation. Defaults to BaseContextSchema.
 */
export interface ToolDefinition< // Renamed interface for clarity
  TInputSchema extends ZodTypeAny = z.ZodUndefined,
  TContextSchema extends ZodTypeAny = typeof BaseContextSchema // Context Schema Generic, defaults to BaseContextSchema
> {
  /** Unique name of the tool. */
  name: string;
  /** Description of what the tool does. */
  description: string;
  /** Zod schema used by the MCP server to validate input arguments. */
  inputSchema: TInputSchema;
  /** Zod schema used to validate the context object. */
  contextSchema: TContextSchema; // Added contextSchema field
  /**
   * The core execution logic for the tool.
   * Receives validated arguments and a context object validated against contextSchema.
   * Should focus purely on the tool's specific task.
   */
  execute: (
    // Context type is inferred from TContextSchema
    params: { context: z.infer<TContextSchema>; args: z.infer<TInputSchema> }
  ) => Promise<Part[]>; // Return Part array directly or throw error
}

/**
 * A helper function to define a Tool with standardized wrapping logic.
 * This wrapper handles generic error catching.
 * The context type is inferred from the provided contextSchema.
 *
 * @template TInputSchema Zod schema for input validation.
 * @template TContextSchema Zod schema for context validation. Defaults to BaseContextSchema.
 * @param definition An object containing the tool's core properties and execute logic.
 * @returns A fully formed ToolDefinition object with wrapped execution logic.
 */
export function defineTool<
  TInputSchema extends ZodTypeAny = z.ZodUndefined,
  TContextSchema extends ZodTypeAny = typeof BaseContextSchema // Context Schema Generic
>(definition: ToolDefinition<TInputSchema, TContextSchema>): ToolDefinition<TInputSchema, TContextSchema> { // Return type uses TContextSchema
  // Return type matches ToolDefinition interface

  /**
   * Wrapped execute function that adds common pre- and post-processing.
   * It receives the context type inferred from the tool definition's contextSchema.
   */
  const wrappedExecute = async (
    // The params object matches the ToolDefinition interface's execute signature
    params: { context: z.infer<TContextSchema>; args: z.infer<TInputSchema> }
  ): Promise<Part[]> => {
    // Return Part array directly
    // Optional: Add context validation here if desired, though the adapter layer might handle it.
    // const contextParsed = definition.contextSchema.safeParse(params.context);
    // if (!contextParsed.success) {
    //   throw new Error(`Context validation failed: ${contextParsed.error.message}`);
    // }

    // Removed the try...catch block as it only re-threw the error.
    // The Adapter layer is responsible for catching errors from the tool execute function.
    // 1. Call the original, tool-specific execute function with the context and args
    //    The types inferred from TContextSchema and TInputSchema ensure this call is type-safe.
    const originalParts = await definition.execute({ context: params.context, args: params.args });
    // 2. Return the parts array on success
    return originalParts;
  };

  // Return the ToolDefinition structure with the wrapped execute function
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    contextSchema: definition.contextSchema, // Pass contextSchema through
    execute: wrappedExecute, // Use the wrapped function
  };
}
