import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { validateAndResolvePath } from '@sylphlab/mcp-core'; // Import base types and validation util
// --- Zod Schema for Input Validation ---
const WriteItemSchema = z.object({
    path: z.string({ required_error: 'path is required' }).min(1, 'path cannot be empty'),
    content: z.string({ required_error: 'content is required' }), // Content is always string
});
export const WriteFilesToolInputSchema = z.object({
    items: z.array(WriteItemSchema).min(1, 'items array cannot be empty'),
    encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8'),
    append: z.boolean().optional().default(false),
});
// --- Tool Definition (following SDK pattern) ---
export const writeFilesTool = {
    name: 'writeFilesTool',
    description: 'Writes or appends content to one or more files within the workspace.',
    inputSchema: WriteFilesToolInputSchema,
    async execute(input, workspaceRoot, options) {
        const parsed = WriteFilesToolInputSchema.safeParse(input);
        if (!parsed.success) {
            const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
                .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
                .join('; ');
            return {
                success: false,
                error: `Input validation failed: ${errorMessages}`,
                results: [],
                content: [],
            };
        }
        const { items, encoding, append } = parsed.data;
        const results = [];
        let anySuccess = false;
        for (const item of items) {
            let itemSuccess = false;
            let message;
            let error;
            let suggestion;
            let resolvedPath;
            const operation = append ? 'append' : 'write';
            // Correct argument order: relativePathInput, workspaceRoot
            const validationResult = validateAndResolvePath(item.path, workspaceRoot, options?.allowOutsideWorkspace);
            // Check if validation succeeded (result is a string)
            if (typeof validationResult === 'string') {
                resolvedPath = validationResult;
                try {
                    // Ensure parent directory exists
                    const dir = path.dirname(resolvedPath);
                    await mkdir(dir, { recursive: true });
                    // Perform write or append
                    const writeOptions = { encoding: encoding };
                    if (append) {
                        await appendFile(resolvedPath, item.content, writeOptions);
                        message = `Content appended successfully to '${item.path}'.`;
                    }
                    else {
                        await writeFile(resolvedPath, item.content, writeOptions);
                        message = `File written successfully to '${item.path}'.`;
                    }
                    itemSuccess = true;
                    anySuccess = true;
                    console.error(message);
                }
                catch (e) {
                    itemSuccess = false;
                    // Handle errors specifically from file operations
                    error = `Failed to ${operation} file '${item.path}': ${e.message}`;
                    console.error(error);
                    if (e.code === 'EACCES') {
                        suggestion = `Check write permissions for the directory containing '${item.path}'.`;
                    }
                    else if (e.code === 'EISDIR') {
                        suggestion = `The path '${item.path}' points to a directory. Provide a path to a file.`;
                    }
                    else if (e.code === 'EROFS') {
                        suggestion = `The file system at '${item.path}' is read-only.`;
                    }
                    else {
                        suggestion = `Check the file path, permissions, and available disk space.`;
                    }
                }
                // Push result for this item (success or file operation error)
                results.push({
                    path: item.path,
                    success: itemSuccess,
                    message: itemSuccess ? message : undefined,
                    error,
                    suggestion: !itemSuccess ? suggestion : undefined,
                });
            }
            else {
                // Validation failed, result is the error object (or unexpected format)
                error = validationResult?.error ?? 'Unknown path validation error'; // Access .error
                suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
                console.error(`Path validation failed for ${item.path}: ${error}. Raw validationResult:`, validationResult);
                results.push({ path: item.path, success: false, error, suggestion });
            }
        } // End loop
        return {
            success: anySuccess,
            results,
            content: anySuccess
                ? [{ type: 'text', text: `Write operation completed. Success: ${anySuccess}` }]
                : [],
        };
    },
};
