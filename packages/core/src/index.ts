// src/index.ts for @sylphlab/mcp-core
import { z } from 'zod';
import path from 'node:path';

// Base type for content parts returned by tools
export type McpContentPart = { type: 'text', text: string } | { type: string, [key: string]: any };

/**
 * Base interface for the output of all MCP tools.
 * Ensures consistency and includes the 'content' field required by the SDK.
 */
export interface BaseMcpToolOutput {
    success: boolean;
    error?: string;
    /** Content parts (e.g., text) for the MCP response. Required by SDK. */
    content: McpContentPart[];
    /** Allow other tool-specific properties like 'results' */
    [key: string]: any;
}

// --- Tool Definition ---

/** Options passed internally to the tool's execute function by the server */
export interface McpToolExecuteOptions {
    /** If true, allows the tool to access paths outside the workspace root. Defaults to false. */
    allowOutsideWorkspace?: boolean;
    // Add other internal options as needed
}

/**
 * Generic interface representing the structure of MCP tools.
 * @template TInputSchema Zod schema for input validation.
 * @template TOutput The specific output type for the tool, extending BaseMcpToolOutput.
 */
export interface McpTool<
    TInputSchema extends z.ZodTypeAny,
    TOutput extends BaseMcpToolOutput
> {
    /** Unique name of the tool. */
    name: string;
    /** Description of what the tool does. */
    description: string;
    /** Zod schema used by the MCP server to validate input arguments. */
    inputSchema: TInputSchema;
    /** The core execution logic for the tool. Receives validated input, workspace root, and optional internal options. */
    execute: (
        input: z.infer<TInputSchema>,
        workspaceRoot: string,
        options?: McpToolExecuteOptions // Added options parameter
    ) => Promise<TOutput>;
}

// Base input type placeholder (can be extended by specific tools if needed)
export interface McpToolInput { [key: string]: any; }


// --- Path Validation Utility ---

export interface PathValidationError {
  error: string;
  suggestion: string;
}

/**
 * Resolves a relative path against the workspace root and validates it.
 * By default, prevents resolving paths outside the workspace root.
 *
 * @param relativePathInput The relative path input by the user/tool.
 * @param workspaceRoot The absolute path to the workspace root.
 * @param allowOutsideRoot If true, allows paths outside the workspace root. Defaults to false.
 * @returns The resolved absolute path (string) if valid, or a PathValidationError object if invalid.
 */
export function validateAndResolvePath(
  relativePathInput: string,
  workspaceRoot: string,
  allowOutsideRoot: boolean = false
): string | PathValidationError {
    console.log(`[validateAndResolvePath] Input: '${relativePathInput}', AllowOutside: ${allowOutsideRoot}`); // DEBUG LOG

  try {
    // Basic check for absolute paths if not allowed outside
    if (!allowOutsideRoot && path.isAbsolute(relativePathInput)) {
       return {
         error: `Path validation failed: Absolute paths are not allowed. Path: '${relativePathInput}'`,
         suggestion: 'Provide a path relative to the workspace root.',
       };
    }

    const resolvedPath = path.resolve(workspaceRoot, relativePathInput);
    const relativeToRoot = path.relative(workspaceRoot, resolvedPath);

    // Only perform the relative path check if allowOutsideRoot is false
    if (!allowOutsideRoot) {
      
    if (!allowOutsideRoot && (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot))) {
      return {
        error: `Path validation failed: Path must resolve within the workspace root ('${workspaceRoot}'). Relative Path: '${relativeToRoot}'`,
        suggestion: `Ensure the path '${relativePathInput}' is relative to the workspace root and does not attempt to go outside it.`,
      };
    }
    }


    // Path is valid
    return resolvedPath;

  } catch (e: any) {
    // Catch potential errors from path functions themselves
     return {
        error: `Path resolution failed for '${relativePathInput}': ${e.message}`,
        suggestion: 'Ensure the provided path is valid.',
      };
  }
}

// PathValidationError is already exported via `export interface`
// Server logic removed - should reside in server implementations
// McpToolExecuteOptions is already exported via `export interface`