import path from 'node:path';
// src/index.ts for @sylphlab/mcp-core
import { type ZodTypeAny, z } from 'zod'; // Import z and ZodTypeAny

export const TextPartInternalSchema = z.object({ type: z.literal('text'), value: z.string() });
export type TextPartInternal = z.infer<typeof TextPartInternalSchema>;

// For JsonPart schema: value is any, schema is any (as Zod schema objects aren't easily serializable/representable in Zod itself)
// Type safety relies on the tool implementation using the correct schema provided during definition.
export const JsonPartInternalSchema = z.object({
  type: z.literal('json'),
  value: z.any(),
  schema: z
    .any()
    .refine((val) => val instanceof z.ZodType, { message: 'Schema must be a Zod schema instance' }),
}); // Use z.ZodType
// Generic type for implementation, using z.any() for the schema's schema part
export type JsonPartInternal<T extends ZodTypeAny = ZodTypeAny> = {
  type: 'json';
  value: z.infer<T>;
  schema: T;
};

export const ImagePartInternalSchema = z.object({
  type: z.literal('image'),
  data: z.string(),
  mimeType: z.string(),
});
export type ImagePartInternal = z.infer<typeof ImagePartInternalSchema>;

export const AudioPartInternalSchema = z.object({
  type: z.literal('audio'),
  data: z.string(),
  mimeType: z.string(),
});
export type AudioPartInternal = z.infer<typeof AudioPartInternalSchema>;

export const FileRefPartInternalSchema = z.object({
  type: z.literal('fileRef'),
  path: z.string(),
  mimeType: z.string().optional(),
});
export type FileRefPartInternal = z.infer<typeof FileRefPartInternalSchema>;

// Union schema for internal parts
export const PartSchema = z.union([
  TextPartInternalSchema,
  JsonPartInternalSchema,
  ImagePartInternalSchema,
  AudioPartInternalSchema,
  FileRefPartInternalSchema,
]);
export type Part = z.infer<typeof PartSchema>;

// Schema for the dedicated error object
export const InternalErrorSchema = z.object({
  message: z.string(),
  suggestion: z.string().optional(),
});
export type InternalError = z.infer<typeof InternalErrorSchema>;

/** Options passed internally to the tool's execute function by the server */
export interface McpToolExecuteOptions {
  /** If true, allows the tool to access paths outside the workspace root. Defaults to false. */
  allowOutsideWorkspace?: boolean;
  /** Optional limit on the total character count of the tool's output content. */
  maxOutputChars?: number;
  /** The absolute path to the workspace root directory. */
  workspaceRoot: string;
  // Add other internal options as needed
}

/**
 * Generic interface representing the structure of Tools (independent of protocol).
 * @template TInputSchema Zod schema for input validation.
 * @template TOutputSchema Zod schema describing the core structured output (optional).
 */
export interface McpTool<
  // Consider renaming to just 'Tool' or 'SylphTool' later
  TInputSchema extends ZodTypeAny = z.ZodUndefined,
  TOutputSchema extends ZodTypeAny = z.ZodUndefined,
> {
  /** Unique name of the tool. */
  name: string;
  /** Description of what the tool does. */
  description: string;
  /** Zod schema used by the MCP server to validate input arguments. */
  inputSchema: TInputSchema;
  /** Zod schema describing the core structured output (optional, used for description). */
  outputSchema?: TOutputSchema; // Added optional outputSchema for description
  /** The core execution logic for the tool. Receives validated input, workspace root, and optional internal options. */
  execute: (
    input: z.infer<TInputSchema>,
    options: McpToolExecuteOptions, // Options object now required and contains workspaceRoot
  ) => Promise<Part[]>; // Returns array of Parts directly
}

// Base input type placeholder (can be extended by specific tools if needed)
export interface McpToolInput {
  [key: string]: unknown;
}

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
  allowOutsideRoot = false,
): string | PathValidationError {
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
      if (
        !allowOutsideRoot &&
        (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot))
      ) {
        return {
          error: `Path validation failed: Path must resolve within the workspace root ('${workspaceRoot}'). Relative Path: '${relativeToRoot}'`,
          suggestion: `Ensure the path '${relativePathInput}' is relative to the workspace root and does not attempt to go outside it.`,
        };
      }
    }

    // Path is valid
    return resolvedPath;
  } catch (e: unknown) {
    // Catch potential errors from path functions themselves
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    return {
      error: `Path resolution failed for '${relativePathInput}': ${errorMsg}`,
      suggestion: 'Ensure the provided path is valid.',
    };
  }
}

// PathValidationError is already exported via `export interface`
// McpToolExecuteOptions is already exported via `export interface`

// --- Part Helper Functions ---

export function textPart(value: string): TextPartInternal {
  return { type: 'text', value };
}

export function jsonPart<T extends ZodTypeAny>(value: z.infer<T>, schema: T): JsonPartInternal<T> {
  // Basic check, full validation might happen in defineTool or adapter
  // const validation = schema.safeParse(value);
  // if (!validation.success) {
  //   console.warn("JSON part value does not match provided schema during creation:", validation.error);
  //   // Decide how to handle - throw? return error part? For now, allow potentially invalid value.
  // }
  return { type: 'json', value, schema };
}

export function imagePart(data: string, mimeType: string): ImagePartInternal {
  return { type: 'image', data, mimeType };
}

export function audioPart(data: string, mimeType: string): AudioPartInternal {
  return { type: 'audio', data, mimeType };
}

export function fileRefPart(path: string, mimeType?: string): FileRefPartInternal {
  return { type: 'fileRef', path, mimeType };
}

export * from './defineTool.js'; // Export the defineTool helper
