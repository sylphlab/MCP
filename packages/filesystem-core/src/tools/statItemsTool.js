import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { validateAndResolvePath } from '@sylphlab/mcp-core';
export const StatItemsToolInputSchema = z.object({
    paths: z.array(z.string({ required_error: 'Each path must be a string' })
        .min(1, 'Path cannot be empty'))
        .min(1, 'paths array cannot be empty'),
});
export const statItemsTool = {
    name: 'statItemsTool',
    description: 'Gets file system stats for one or more specified paths within the workspace.',
    inputSchema: StatItemsToolInputSchema,
    async execute(input, workspaceRoot, options) {
        const parsed = StatItemsToolInputSchema.safeParse(input);
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
        const { paths: inputPaths } = parsed.data;
        const results = [];
        let anySuccess = false;
        for (const itemPath of inputPaths) {
            let itemSuccess = false;
            let itemStat = undefined;
            let error;
            let suggestion;
            let resolvedPath;
            // Correct argument order: relativePathInput, workspaceRoot
            const validationResult = validateAndResolvePath(itemPath, workspaceRoot, options?.allowOutsideWorkspace);
            // Check if validation succeeded (result is a string)
            if (typeof validationResult === 'string') {
                resolvedPath = validationResult;
                try {
                    itemStat = await stat(resolvedPath);
                    itemSuccess = true;
                    anySuccess = true;
                }
                catch (e) {
                    itemSuccess = false;
                    if (e.code === 'ENOENT') {
                        error = `Path '${itemPath}' not found.`;
                        suggestion = `Ensure the path '${itemPath}' exists.`;
                        console.error(error);
                    }
                    else {
                        error = `Failed to get stats for '${itemPath}': ${e.message}`;
                        console.error(error);
                        if (e.code === 'EACCES') {
                            suggestion = `Check permissions for the path '${itemPath}'.`;
                        }
                        else {
                            suggestion = `Check the path and permissions.`;
                        }
                    }
                }
                results.push({
                    path: itemPath,
                    success: itemSuccess,
                    stat: itemStat,
                    error,
                    suggestion,
                });
            }
            else {
                // Validation failed, result is the error object (or unexpected format)
                error = validationResult?.error ?? 'Unknown path validation error'; // Access .error
                suggestion = validationResult?.suggestion ?? 'Review path and workspace settings.';
                console.error(`Path validation failed for ${itemPath}: ${error}. Raw validationResult:`, validationResult);
                results.push({ path: itemPath, success: false, error, suggestion });
            }
        } // End loop
        return {
            success: anySuccess,
            results,
            content: anySuccess
                ? [{ type: 'text', text: `Stat operation completed. Success: ${anySuccess}` }]
                : [],
        };
    },
};
