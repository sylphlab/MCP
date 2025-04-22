import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@sylphlab/mcp-core';
import { jsonPart, validateAndResolvePath } from '@sylphlab/mcp-core';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { z } from 'zod';
import { readFilesToolInputSchema } from './readFilesTool.schema.js';

// Define BufferEncoding type for Zod schema if needed, or rely on schema definition
type BufferEncoding = 'utf-8' | 'base64';

// Infer the TypeScript type from the Zod schema
export type ReadFilesToolInput = z.infer<typeof readFilesToolInputSchema>;

// --- Output Types ---
export interface ReadFileResult {
  /** The file path processed (relative to workspace root). */
  path: string;
  /** Whether the read operation for this specific file was successful. */
  success: boolean;
  /** The content of the file, as a string (respecting encoding). */
  content?: string;
  /** Optional array of lines with line numbers (if includeLineNumbers was true). */
  lines?: { lineNumber: number; text: string }[];
  /** Optional SHA-256 hash of the file content (if includeHash was true). */
  hash?: string;
  /** Optional file system stats (if includeStats was true). */
  stat?: Stats;
  /** Optional error message if the operation failed for this file. */
  error?: string;
  /** Optional suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual file result (used in outputSchema)
const ReadFileResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  content: z.string().optional(),
  lines: z.array(z.object({ lineNumber: z.number(), text: z.string() })).optional(),
  hash: z.string().optional(),
  stat: z.custom<Stats>().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the specific output schema for this tool
const ReadFilesOutputSchema = z.array(ReadFileResultSchema);

// --- Tool Definition using defineTool ---

export const readFilesTool = defineTool({
  name: 'readFilesTool',
  description: 'Reads the content of one or more files within the workspace.',
  inputSchema: readFilesToolInputSchema,
  outputSchema: ReadFilesOutputSchema,

  execute: async (input: ReadFilesToolInput, options: McpToolExecuteOptions): Promise<Part[]> => {
    // Zod validation (throw error on failure)
    const parsed = readFilesToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    // Get options from parsed data, using defaults from schema if not provided
    const {
      paths: inputPaths,
      encoding,
      includeStats,
      includeLineNumbers,
      includeHash,
    } = parsed.data;

    const results: ReadFileResult[] = [];

    for (const itemPath of inputPaths) {
      let itemSuccess = false;
      let content: string | undefined = undefined;
      let itemStat: Stats | undefined = undefined;
      let itemLines: { lineNumber: number; text: string }[] | undefined = undefined;
      let itemHash: string | undefined = undefined;
      let error: string | undefined;
      let suggestionForError: string | undefined;
      let fullPath: string | undefined;

      // --- Validate Path ---
      const validationResult = validateAndResolvePath(
        itemPath,
        options.workspaceRoot,
        options?.allowOutsideWorkspace,
      );
      if (typeof validationResult !== 'string') {
        error = `Path validation failed: ${validationResult.error}`;
        suggestionForError = validationResult.suggestion;
        results.push({ path: itemPath, success: false, error, suggestion: suggestionForError });
        continue; // Skip to next itemPath
      }
      fullPath = validationResult;
      // --- End Path Validation ---

      // Keep try/catch for individual file read errors
      try {
        // Optionally get stats first
        if (includeStats) {
          itemStat = await stat(fullPath);
          if (!itemStat.isFile()) {
            throw new Error(`Path '${itemPath}' is not a file.`);
          }
        }

        // Read the file content with specified encoding
        const fileBuffer = await readFile(fullPath);
        content = fileBuffer.toString(encoding as BufferEncoding);

        // Calculate hash if requested
        if (includeHash) {
          itemHash = createHash('sha256').update(fileBuffer).digest('hex');
        }

        // Generate lines if requested
        if (includeLineNumbers) {
          // Corrected split regex
          itemLines = content.split(/\r?\n/).map((line, index) => ({
            lineNumber: index + 1,
            text: line,
          }));
        }

        itemSuccess = true;
      } catch (e: unknown) {
        itemSuccess = false;
        let errorCode: string | null = null;
        let errorMsg = 'Unknown error';

        if (e && typeof e === 'object') {
          if ('code' in e) errorCode = String((e as { code: unknown }).code);
        }
        if (e instanceof Error) errorMsg = e.message;

        // Provide specific errors based on code
        if (errorCode === 'ENOENT') {
          error = `Failed to read '${itemPath}': File not found.`;
        } else if (errorCode === 'EISDIR') {
          error = `Failed to read '${itemPath}': Path is a directory, not a file.`;
        } else {
          error = `Failed to read '${itemPath}': ${errorMsg}`;
        }

        // Add suggestion based on error code or message
        if (errorCode === 'ENOENT') {
          const parentDir = path.dirname(itemPath);
          suggestionForError = `Ensure the file path '${itemPath}' is correct and the file exists. You could try listing the directory contents using listFilesTool on '${parentDir === '.' ? '.' : parentDir}' to check available files.`;
        } else if (errorCode === 'EISDIR' || errorMsg.includes('is not a file')) {
          suggestionForError = `The path '${itemPath}' points to a directory. Provide a path to a file.`;
        } else if (errorCode === 'EACCES') {
          suggestionForError = `Check read permissions for the file '${itemPath}'.`;
        } else {
          suggestionForError = 'Check the file path and permissions.';
        }
      }

      // Push result for this file
      results.push({
        path: itemPath,
        success: itemSuccess,
        content: itemSuccess ? content : undefined, // Only include content on success
        lines: itemSuccess ? itemLines : undefined,
        hash: itemSuccess ? itemHash : undefined,
        stat: itemSuccess ? itemStat : undefined,
        error,
        suggestion: !itemSuccess ? suggestionForError : undefined,
      });
    } // End for loop

    // Return the parts array directly
    return [jsonPart(results, ReadFilesOutputSchema)];
  },
});
