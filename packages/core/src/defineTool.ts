import type { z } from 'zod';
import type { BaseMcpToolOutput, McpTool, McpToolExecuteOptions } from './index';
// Assuming checkOutputSizeLimit is correctly exported from utils
// Adjust the import path if utils is structured differently or not directly accessible
// If utils is not a direct dependency of core, this helper might need to move to core
// or be passed in somehow. For now, assume it can be imported.
import { checkOutputSizeLimit } from './outputUtils.js'; // Import locally from core

/**
 * Defines the structure required to define a tool using the defineTool helper.
 * @template TInputSchema Zod schema for input validation.
 * @template TOutput The specific output type for the tool's core execute logic.
 */
interface ToolDefinition<
  TInputSchema extends z.ZodTypeAny,
  TOutput extends BaseMcpToolOutput,
> {
  /** Unique name of the tool. */
  name: string;
  /** Description of what the tool does. */
  description: string;
  /** Zod schema used by the MCP server to validate input arguments. */
  inputSchema: TInputSchema;
  /**
   * The core execution logic for the tool.
   * Receives validated input and execution options.
   * Should focus purely on the tool's specific task.
   */
  execute: (
    input: z.infer<TInputSchema>,
    options: McpToolExecuteOptions,
  ) => Promise<TOutput>;
}

/**
 * A helper function to define an McpTool with standardized wrapping logic.
 * This wrapper handles generic error catching and applies output size limits.
 *
 * @template TInputSchema Zod schema for input validation.
 * @template TOutput The specific output type expected from the core execute logic.
 * @param definition An object containing the tool's core properties and execute logic.
 * @returns A fully formed McpTool object with wrapped execution logic.
 */
export function defineTool<
  TInputSchema extends z.ZodTypeAny,
  TOutput extends BaseMcpToolOutput,
>(
  definition: ToolDefinition<TInputSchema, TOutput>,
): McpTool<TInputSchema, BaseMcpToolOutput> { // Change return type to use BaseMcpToolOutput

  /**
   * Wrapped execute function that adds common pre- and post-processing.
   */
  const wrappedExecute = async (
    input: z.infer<TInputSchema>,
    options: McpToolExecuteOptions, // Options are received here
  ): Promise<BaseMcpToolOutput> => { // Actual implementation can return TOutput | BaseMcpToolOutput, assignable to Promise<BaseMcpToolOutput>
    try {
      // 1. Call the original, tool-specific execute function
      const originalResult = await definition.execute(input, options);

      // 2. Apply the output size check using the imported helper
      // Pass the options object which might contain maxOutputChars
      const checkedResult = checkOutputSizeLimit(originalResult, options);

      // Type assertion is likely not needed as TOutput extends BaseMcpToolOutput
      // and checkOutputSizeLimit returns BaseMcpToolOutput on error.
      return checkedResult; // Return checked result (TOutput on success, BaseMcpToolOutput on error)

    } catch (error: unknown) {
      // 3. Handle generic execution errors from the original execute function
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
      // Return a standardized error format conforming to BaseMcpToolOutput
      return {
        success: false,
        error: `Tool '${definition.name}' execution failed: ${errorMessage}`,
        content: [{ type: 'text', text: `Tool execution failed: ${errorMessage}` }],
        // Ensure this structure matches BaseMcpToolOutput
      } as BaseMcpToolOutput; // Explicitly cast the error case
    }
  };

  // Return the McpTool structure with the wrapped execute function
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    execute: wrappedExecute, // Use the wrapped function
  };
}