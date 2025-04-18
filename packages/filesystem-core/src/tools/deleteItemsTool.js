import { rm } from 'node:fs/promises';
import { z } from 'zod';
import trash from 'trash';
import { validateAndResolvePath } from '@sylphlab/mcp-core';
// --- Zod Schema for Input Validation ---
export const DeleteItemsToolInputSchema = z.object({
    paths: z.array(z.string({ required_error: 'Each path must be a string' })
        .min(1, 'Path cannot be empty'))
        .min(1, 'paths array cannot be empty'),
    recursive: z.boolean().optional().default(true),
    useTrash: z.boolean().optional().default(true),
    // allowOutsideWorkspace removed from schema
});
// --- Tool Definition ---
export const deleteItemsTool = {
    name: 'deleteItemsTool',
    description: 'Deletes specified files or directories (supports globs - TODO: implement glob support). Uses trash by default.',
    inputSchema: DeleteItemsToolInputSchema,
    async execute(input, workspaceRoot, options) {
        // Zod validation
        const parsed = DeleteItemsToolInputSchema.safeParse(input);
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
        const { paths: inputPaths, recursive, useTrash } = parsed.data;
        // TODO: Implement glob expansion for inputPaths if needed
        const resolvedPaths = inputPaths; // Placeholder for now
        const results = [];
        let overallSuccess = true; // Assume success until a failure occurs
        for (const itemPath of resolvedPaths) {
            let itemSuccess = false;
            let message;
            let error;
            let suggestion;
            const deleteMethod = useTrash ? 'trash' : 'delete permanently';
            // --- Validate and Resolve Path ---
            const validationResult = validateAndResolvePath(itemPath, workspaceRoot, options?.allowOutsideWorkspace);
            if (typeof validationResult !== 'string') {
                error = validationResult.error;
                suggestion = validationResult.suggestion;
                console.error(`Skipping delete for '${itemPath}': ${error}`);
                overallSuccess = false;
                results.push({ path: itemPath, success: false, error, suggestion });
                continue; // Skip to next itemPath
            }
            const fullPath = validationResult;
            // --- End Path Validation ---
            try {
                if (useTrash) {
                    await trash(fullPath);
                }
                else {
                    // force: true ignores errors if path doesn't exist, which is desired here
                    await rm(fullPath, { recursive: recursive, force: true });
                }
                itemSuccess = true;
                message = `Item '${itemPath}' deleted (${deleteMethod}) successfully.`;
                console.error(message); // Log success to stderr
            }
            catch (e) {
                itemSuccess = false;
                overallSuccess = false;
                error = `Failed to ${deleteMethod} '${itemPath}': ${e.message}`;
                console.error(error);
                suggestion = `Check permissions for '${itemPath}' and its parent directories. Ensure the file/folder exists if using 'rm' without 'force: true'.`;
            }
            results.push({
                path: itemPath,
                success: itemSuccess,
                message: itemSuccess ? message : undefined,
                error,
                suggestion: !itemSuccess ? suggestion : undefined,
            });
        }
        return {
            success: overallSuccess, // True only if ALL operations succeeded without path validation errors or execution errors
            results,
            content: overallSuccess
                ? [{ type: 'text', text: `Delete operation completed. Success: ${overallSuccess}` }]
                : [],
        };
    },
};
