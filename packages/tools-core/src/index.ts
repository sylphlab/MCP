import path from 'node:path';
// src/index.ts for @sylphlab/mcp-core
import { type ZodTypeAny, z } from 'zod'; // Import z and ZodTypeAny

export const TextPartSchema = z.object({ type: z.literal('text'), value: z.string() });
export type TextPart = z.infer<typeof TextPartSchema>;

// For JsonPart schema: value is any, schema is any (as Zod schema objects aren't easily serializable/representable in Zod itself)
// Type safety relies on the tool implementation using the correct schema provided during definition.
export const JsonPartSchema = z.object({
  type: z.literal('json'),
  value: z.any(),
  schema: z
    .any()
    .refine((val) => val instanceof z.ZodType, { message: 'Schema must be a Zod schema instance' }),
}); // Use z.ZodType
// Generic type for implementation, using z.any() for the schema's schema part
export type JsonPart<T extends ZodTypeAny = ZodTypeAny> = {
  type: 'json';
  value: z.infer<T>;
  schema: T;
};

export const ImagePartSchema = z.object({
  type: z.literal('image'),
  data: z.string(),
  mimeType: z.string(),
});
export type ImagePart = z.infer<typeof ImagePartSchema>;

export const AudioPartSchema = z.object({
  type: z.literal('audio'),
  data: z.string(),
  mimeType: z.string(),
});
export type AudioPart = z.infer<typeof AudioPartSchema>;

export const FileRefPartSchema = z.object({
  type: z.literal('fileRef'),
  path: z.string(),
  mimeType: z.string().optional(),
});
export type FileRefPart = z.infer<typeof FileRefPartSchema>;

// Union schema for internal parts
export const PartSchema = z.union([
  TextPartSchema,
  JsonPartSchema,
  ImagePartSchema,
  AudioPartSchema,
  FileRefPartSchema,
]);
export type Part = z.infer<typeof PartSchema>;

// Schema for the dedicated error object
export const ErrorSchema = z.object({
  message: z.string(),
  suggestion: z.string().optional(),
});
export type Error = z.infer<typeof ErrorSchema>;

/** Options passed internally to the tool's execute function by the server */
export interface ToolExecuteOptions {
  /** If true, allows the tool to access paths outside the workspace root. Defaults to false. */
  allowOutsideWorkspace?: boolean;
  /** Optional limit on the total character count of the tool's output content. */
  maxOutputChars?: number;
  /** The absolute path to the workspace root directory. */
  workspaceRoot: string;
  // Add other internal options as needed
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
  // Add check for empty input path
  if (!relativePathInput || relativePathInput.trim() === '') {
      return {
          error: 'Path validation failed: Input path cannot be empty.',
          suggestion: 'Provide a valid relative path.',
      };
  }

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
// ToolExecuteOptions is already exported via `export interface`

// --- Part Helper Functions ---

export function textPart(value: string): TextPart {
  return { type: 'text', value };
}

export function jsonPart<T extends ZodTypeAny>(value: z.infer<T>, schema: T): JsonPart<T> {
  // Basic check, full validation might happen in defineTool or adapter
  // const validation = schema.safeParse(value);
  // if (!validation.success) {
  //   console.warn("JSON part value does not match provided schema during creation:", validation.error);
  //   // Decide how to handle - throw? return error part? For now, allow potentially invalid value.
  // }
  return { type: 'json', value, schema };
}

export function imagePart(data: string, mimeType: string): ImagePart {
  return { type: 'image', data, mimeType };
}

export function audioPart(data: string, mimeType: string): AudioPart {
  return { type: 'audio', data, mimeType };
}

export function fileRefPart(path: string, mimeType?: string): FileRefPart {
  return { type: 'fileRef', path, mimeType };
}

export * from './defineTool.js'; // Export the defineTool helper
export * from './typeGuards.js'; // Export type guards and related types
