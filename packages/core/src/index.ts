// src/index.ts for @sylphlab/mcp-core
import { z } from 'zod';

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
    /** The core execution logic for the tool. */
    execute: (input: z.infer<TInputSchema>, workspaceRoot: string) => Promise<TOutput>;
}

// Base input type placeholder (can be extended by specific tools if needed)
export interface McpToolInput { [key: string]: any; }

// Server logic removed - should reside in server implementations