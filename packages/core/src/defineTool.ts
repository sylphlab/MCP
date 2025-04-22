import type { ZodTypeAny, z } from 'zod'; // Use import type
import type {
  // InternalToolExecutionResult, // Removed - execute returns Part[]
  InternalError, // Import internal error type
  // BaseMcpToolOutput, // Removed - No longer used here
  McpTool,
  McpToolExecuteOptions,
  Part, // Import Part type
  // errorPart, // Moved to value import
} from './index';
// Assuming checkOutputSizeLimit is correctly exported from utils
// Adjust the import path if utils is structured differently or not directly accessible
// If utils is not a direct dependency of core, this helper might need to move to core
// or be passed in somehow. For now, assume it can be imported.
// import { checkOutputSizeLimit } from './outputUtils.js'; // Removed - Size check moved to Adapter/Server layer

/**
 * Defines the structure required to define a tool using the defineTool helper.
 * @template TInputSchema Zod schema for input validation.
 * @template TOutputSchema Zod schema describing the core structured output (optional).
 */
interface ToolDefinition<
  TInputSchema extends ZodTypeAny = z.ZodUndefined,
  TOutputSchema extends ZodTypeAny = z.ZodUndefined, // Use TOutputSchema
> {
  /** Unique name of the tool. */
  name: string;
  /** Description of what the tool does. */
  description: string;
  /** Zod schema used by the MCP server to validate input arguments. */
  inputSchema: TInputSchema;
  /** Zod schema describing the core structured output (optional, used for description). */
  outputSchema?: TOutputSchema; // Added optional outputSchema
  /**
   * The core execution logic for the tool.
   * Receives validated input and execution options.
   * Should focus purely on the tool's specific task.
   */
  execute: (
    input: z.infer<TInputSchema>, // Use z.infer for input type
    options: McpToolExecuteOptions,
  ) => Promise<Part[]>; // Return Part array directly or throw error
}

/**
 * A helper function to define an McpTool with standardized wrapping logic.
 * This wrapper handles generic error catching and applies output size limits.
 *
 * @template TInputSchema Zod schema for input validation.
 * @template TOutputSchema Zod schema describing the core structured output (optional).
 * @param definition An object containing the tool's core properties and execute logic.
 * @returns A fully formed McpTool object with wrapped execution logic.
 */
export function defineTool<
  TInputSchema extends ZodTypeAny = z.ZodUndefined,
  TOutputSchema extends ZodTypeAny = z.ZodUndefined, // Use TOutputSchema
>(definition: ToolDefinition<TInputSchema, TOutputSchema>): McpTool<TInputSchema, TOutputSchema> {
  // Return type matches McpTool interface

  /**
   * Wrapped execute function that adds common pre- and post-processing.
   */
  const wrappedExecute = async (
    input: z.infer<TInputSchema>, // Use z.infer
    options: McpToolExecuteOptions, // Options are received here
  ): Promise<Part[]> => {
    // Return Part array directly
    // Removed the try...catch block as it only re-threw the error.
    // The Adapter layer is responsible for catching errors from the tool execute function.
    // 1. Call the original, tool-specific execute function
    const originalParts = await definition.execute(input, options);
    // 2. Return the parts array on success
    return originalParts;
  };

  // Return the McpTool structure with the wrapped execute function
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema, // Pass outputSchema through
    execute: wrappedExecute, // Use the wrapped function
  };
}
