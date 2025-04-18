import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { validateAndResolvePath } from '@sylphlab/mcp-core'; // Import base types and validation util
// --- Zod Schema for Input Validation ---
export const ReadFilesToolInputSchema = z.object({
    paths: z.array(z.string({ required_error: 'Each path must be a string' })
        .min(1, 'Path cannot be empty'))
        .min(1, 'paths array cannot be empty'),
    encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8'),
    includeStats: z.boolean().optional().default(false),
    // allowOutsideWorkspace removed from schema
});
// --- Tool Definition (following SDK pattern) ---
export const readFilesTool = {
    name: 'readFilesTool',
    description: 'Reads the content of one or more files within the workspace.',
    inputSchema: ReadFilesToolInputSchema,
    async execute(input, workspaceRoot, options) {
        // Zod validation
        const parsed = ReadFilesToolInputSchema.safeParse(input);
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
        const { paths: inputPaths, encoding, includeStats } = parsed.data; // allowOutsideWorkspace comes from options
        // --- End Zod Validation ---
        const results = [];
        let anySuccess = false;
        for (const itemPath of inputPaths) {
            let itemSuccess = false;
            let content = undefined;
            let itemStat = undefined;
            let error;
            let suggestionForError;
            let fullPath;
            // --- Validate Path ---
            const validationResult = validateAndResolvePath(itemPath, workspaceRoot, options?.allowOutsideWorkspace);
            if (typeof validationResult !== 'string') {
                error = `Path validation failed: ${validationResult.error}`;
                suggestionForError = validationResult.suggestion;
                console.error(`Skipping read for ${itemPath}: ${error}`);
                results.push({ path: itemPath, success: false, error, suggestion: suggestionForError });
                // anySuccess remains false or keeps previous value
                continue; // Skip to next itemPath
            }
            else {
                fullPath = validationResult; // Path is valid and resolved
            }
            // --- End Path Validation ---
            // Proceed only if path is valid
            if (fullPath) {
                try {
                    // Optionally get stats first
                    if (includeStats) {
                        itemStat = await stat(fullPath); // Use validated path
                        // Ensure it's a file if stats are requested
                        if (!itemStat.isFile()) {
                            throw new Error(`Path '${itemPath}' is not a file.`);
                        }
                    }
                    // Read the file content with specified encoding
                    const fileBuffer = await readFile(fullPath); // Use validated path
                    content = fileBuffer.toString(encoding);
                    itemSuccess = true;
                    anySuccess = true; // Mark overall success if at least one works
                }
                catch (e) {
                    itemSuccess = false;
                    // Provide specific errors
                    if (e.code === 'ENOENT') {
                        error = `Failed to read '${itemPath}': File not found.`;
                    }
                    else if (e.code === 'EISDIR') {
                        error = `Failed to read '${itemPath}': Path is a directory, not a file.`;
                    }
                    else {
                        error = `Failed to read '${itemPath}': ${e.message}`;
                    }
                    console.error(error);
                    // Add suggestion based on error
                    if (e.code === 'ENOENT') {
                        const parentDir = path.dirname(itemPath);
                        suggestionForError = `Ensure the file path '${itemPath}' is correct and the file exists. You could try listing the directory contents using listFilesTool on '${parentDir === '.' ? '.' : parentDir}' to check available files.`;
                    }
                    else if (e.code === 'EISDIR' || e.message.includes('is not a file')) {
                        suggestionForError = `The path '${itemPath}' points to a directory. Provide a path to a file.`;
                    }
                    else if (e.code === 'EACCES') {
                        suggestionForError = `Check read permissions for the file '${itemPath}'.`;
                    }
                    else {
                        suggestionForError = `Check the file path and permissions.`;
                    }
                    // Assign suggestion to the result object later
                }
            }
            results.push({
                path: itemPath,
                success: itemSuccess,
                content,
                stat: itemStat,
                error,
                suggestion: !itemSuccess ? suggestionForError : undefined, // Use the suggestion calculated in the catch block
            });
        }
        return {
            success: anySuccess, // True if at least one read succeeded
            results,
            // Add a default success message to content if overall successful
            content: anySuccess
                ? [{ type: 'text', text: `Read operation completed. Success: ${anySuccess}` }]
                : [],
        };
    },
};
