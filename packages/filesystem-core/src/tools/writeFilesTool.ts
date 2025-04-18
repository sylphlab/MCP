import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput } from '@sylphlab/mcp-core'; // Import base types

// Define BufferEncoding type for Zod schema
type BufferEncoding = 'utf-8' | 'base64'; // Add others if needed

// --- Zod Schema for Input Validation ---
const WriteItemSchema = z.object({
  path: z.string({ required_error: 'path is required' }).min(1, 'path cannot be empty'),
  content: z.string({ required_error: 'content is required' }), // Content is always string
});

const WriteFilesToolInputSchema = z.object({
  items: z.array(WriteItemSchema).min(1, 'items array cannot be empty'),
  encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8'),
  append: z.boolean().optional().default(false),
});

// Infer the TypeScript type from the Zod schema
export type WriteFilesToolInput = z.infer<typeof WriteFilesToolInputSchema>;

// --- Output Types ---
export interface WriteFileResult {
  /** The file path provided in the input. */
  path: string;
  /** Whether the write/append operation for this specific file was successful. */
  success: boolean;
  /** Optional message providing more details (e.g., "File written", "Content appended"). */
  message?: string;
  /** Optional error message if the operation failed for this file. */
  error?: string;
}

// Extend the base output type
export interface WriteFilesToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true if at least one file was written/appended successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Array of results for each file write/append operation. */
  results: WriteFileResult[];
}

// --- Tool Definition (following SDK pattern) ---

export const writeFilesTool: McpTool<typeof WriteFilesToolInputSchema, WriteFilesToolOutput> = {
  name: 'writeFilesTool',
  description: 'Writes or appends content to one or more files within the workspace.',
  inputSchema: WriteFilesToolInputSchema,

  async execute(input: WriteFilesToolInput, workspaceRoot: string): Promise<WriteFilesToolOutput> {
    // Zod validation
    const parsed = WriteFilesToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      return {
        success: false,
        error: `Input validation failed: ${errorMessages}`,
        results: [],
        content: [], // Add required content field
      };
    }
    const { items, encoding, append } = parsed.data;
    // --- End Zod Validation ---

    const results: WriteFileResult[] = [];
    let anySuccess = false;

    for (const item of items) {
      const fullPath = path.resolve(workspaceRoot, item.path);
      let itemSuccess = false;
      let message: string | undefined;
      let error: string | undefined;
      const operation = append ? 'append' : 'write';

      // --- Security Check ---
      const relativePath = path.relative(workspaceRoot, fullPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          error = `Path validation failed: Path must resolve within the workspace root ('${workspaceRoot}'). Relative Path: '${relativePath}'`;
          console.error(`Skipping ${operation} for ${item.path}: ${error}`);
      } else {
        try {
          // Ensure parent directory exists
          const dir = path.dirname(fullPath);
          await mkdir(dir, { recursive: true });

          // Perform write or append
          const options = { encoding: encoding as BufferEncoding }; // Cast encoding
          if (append) {
            await appendFile(fullPath, item.content, options);
            message = `Content appended successfully to '${item.path}'.`;
          } else {
            await writeFile(fullPath, item.content, options);
            message = `File written successfully to '${item.path}'.`;
          }
          itemSuccess = true;
          anySuccess = true;
          console.log(message);

        } catch (e: any) {
          itemSuccess = false;
          error = `Failed to ${operation} file '${item.path}': ${e.message}`;
          console.error(error);
        }
      }

      results.push({
        path: item.path,
        success: itemSuccess,
        message,
        error,
      });
    }

    return {
      success: anySuccess, // True if at least one operation succeeded
      results,
      content: [], // Add required content field
    };
  },
};