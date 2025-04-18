import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { validateAndResolvePath } from '@sylphlab/mcp-core'; // Import base types and validation util
// --- Zod Schema for Input Validation ---
export const ListFilesToolInputSchema = z.object({
    paths: z.array(z.string({ required_error: 'Each path must be a string' })
        .min(1, 'Path cannot be empty'))
        .min(1, 'paths array cannot be empty'),
    recursive: z.boolean().optional().default(false),
    maxDepth: z.number().int().min(0).optional(),
    includeStats: z.boolean().optional().default(false),
    // allowOutsideWorkspace removed from schema
});
// --- Helper Function for Recursive Listing ---
async function listDirectoryRecursive(dirPath, workspaceRoot, currentDepth, maxDepth, includeStats) {
    let entries = [];
    const dirents = await readdir(dirPath, { withFileTypes: true });
    for (const dirent of dirents) {
        const fullPath = path.join(dirPath, dirent.name);
        const relativePath = path.relative(workspaceRoot, fullPath);
        let entryStat = undefined;
        if (includeStats) {
            try {
                // Use lstat to avoid following symlinks if stats are requested
                entryStat = await stat(fullPath);
            }
            catch (statError) {
                console.error(`Could not get stats for ${relativePath}: ${statError.message}`);
                // Continue without stats if stat fails
            }
        }
        const isDirectory = dirent.isDirectory();
        const isFile = dirent.isFile();
        entries.push({
            name: dirent.name,
            path: relativePath,
            isDirectory: isDirectory,
            isFile: isFile,
            stat: entryStat,
        });
        if (isDirectory && (maxDepth === undefined || currentDepth < maxDepth)) {
            try {
                const subEntries = await listDirectoryRecursive(fullPath, workspaceRoot, currentDepth + 1, maxDepth, includeStats);
                entries = entries.concat(subEntries);
            }
            catch (recursiveError) {
                console.error(`Could not read subdirectory ${relativePath}: ${recursiveError.message}`);
                // Include the directory entry itself even if listing its contents failed
            }
        }
    }
    return entries;
}
// --- Tool Definition (following SDK pattern) ---
export const listFilesTool = {
    name: 'listFilesTool',
    description: 'Lists files and directories within one or more specified paths in the workspace.',
    inputSchema: ListFilesToolInputSchema,
    async execute(input, workspaceRoot, options) {
        // Zod validation
        const parsed = ListFilesToolInputSchema.safeParse(input);
        if (!parsed.success) {
            const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
                .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
                .join('; ');
            return {
                success: false,
                error: `Input validation failed: ${errorMessages}`,
                results: {},
                content: [], // Add required content field
            };
        }
        const { paths: inputPaths, recursive, maxDepth, includeStats } = parsed.data; // allowOutsideWorkspace comes from options
        // --- End Zod Validation ---
        const results = {};
        let anySuccess = false;
        for (const inputPath of inputPaths) {
            // const fullPath = path.resolve(workspaceRoot, inputPath); // Remove original declaration
            let pathSuccess = false;
            let pathEntries = undefined;
            let pathError;
            let pathSuggestion; // Declare pathSuggestion here
            // --- Validate and Resolve Path ---
            const validationResult = validateAndResolvePath(inputPath, workspaceRoot, options?.allowOutsideWorkspace);
            let fullPath; // Declare fullPath here
            if (typeof validationResult !== 'string') {
                pathError = validationResult.error;
                pathSuggestion = validationResult.suggestion; // Assign suggestion from validation
                console.error(`Skipping path ${inputPath}: ${pathError}`);
                results[inputPath] = { success: false, error: pathError, suggestion: pathSuggestion };
                // anySuccess remains false or keeps previous value
                continue; // Skip to next inputPath
            }
            else {
                fullPath = validationResult; // Path is valid and resolved
                // --- End Path Validation ---
                try {
                    // Check if path exists and is a directory before reading
                    const pathStat = await stat(fullPath); // Use validated fullPath
                    if (!pathStat.isDirectory()) {
                        throw new Error(`Path '${inputPath}' is not a directory.`);
                    }
                    if (recursive) {
                        pathEntries = await listDirectoryRecursive(fullPath, workspaceRoot, 0, maxDepth, includeStats);
                    }
                    else {
                        // Non-recursive: read only the top level
                        const dirents = await readdir(fullPath, { withFileTypes: true });
                        pathEntries = [];
                        for (const dirent of dirents) {
                            const entryFullPath = path.join(fullPath, dirent.name);
                            const entryRelativePath = path.relative(workspaceRoot, entryFullPath);
                            let entryStat = undefined;
                            if (includeStats) {
                                try {
                                    entryStat = await stat(entryFullPath);
                                }
                                catch (statError) {
                                    console.error(`Could not get stats for ${entryRelativePath}: ${statError.message}`);
                                }
                            }
                            pathEntries.push({
                                name: dirent.name,
                                path: entryRelativePath,
                                isDirectory: dirent.isDirectory(),
                                isFile: dirent.isFile(),
                                stat: entryStat,
                            });
                        }
                    }
                    pathSuccess = true;
                    anySuccess = true; // Mark overall success if at least one works
                }
                catch (e) {
                    pathSuccess = false;
                    pathError = `Error listing path '${inputPath}': ${e.message}`;
                    console.error(pathError);
                    // Add suggestion based on error
                    // let suggestion: string | undefined; // pathSuggestion already declared above
                    if (e.code === 'ENOENT') {
                        pathSuggestion = `Ensure the path '${inputPath}' exists.`; // Assign directly
                    }
                    else if (e.message.includes('is not a directory')) {
                        pathSuggestion = `The path '${inputPath}' points to a file, not a directory. Provide a directory path.`; // Assign directly
                    }
                    else {
                        pathSuggestion = `Check permissions for '${inputPath}' and ensure it is a valid directory path.`; // Assign directly
                    }
                }
            }
            // Assign result, including suggestion if an error occurred
            results[inputPath] = {
                success: pathSuccess,
                entries: pathEntries,
                error: pathError,
                suggestion: pathSuggestion,
            };
        }
        return {
            success: anySuccess, // True if at least one path succeeded
            results,
            // Add a default success message to content if overall successful
            content: anySuccess
                ? [{ type: 'text', text: `List operation completed. Success: ${anySuccess}` }]
                : [],
        };
    },
};
