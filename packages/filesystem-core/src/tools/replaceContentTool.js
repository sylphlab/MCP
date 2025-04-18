import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import glob from 'fast-glob'; // Import fast-glob
// --- Zod Schema for Input Validation ---
const ReplaceOperationSchema = z.object({
    search: z.string().min(1, 'search pattern cannot be empty'),
    replace: z.string(),
    isRegex: z.boolean().optional().default(false),
    flags: z.string().optional(), // e.g., 'g', 'i', 'm', 'gi'
}).refine(data => !data.isRegex || data.flags === undefined || /^[gimyus]+$/.test(data.flags), {
    message: "Invalid regex flags provided. Only 'g', 'i', 'm', 'y', 'u', 's' are allowed.",
    path: ['flags'],
});
export const ReplaceContentToolInputSchema = z.object({
    paths: z.array(z.string({ required_error: 'Each path/glob must be a string' })
        .min(1, 'Path/glob cannot be empty'))
        .min(1, 'paths array cannot be empty'),
    operations: z.array(ReplaceOperationSchema).min(1, 'operations array cannot be empty'),
    // allowOutsideWorkspace removed from schema
});
// --- Tool Definition (following SDK pattern) ---
export const replaceContentTool = {
    name: 'replaceContentTool',
    description: 'Performs search and replace operations across multiple files (supports globs).',
    inputSchema: ReplaceContentToolInputSchema,
    async execute(input, workspaceRoot, options) {
        // Zod validation
        const parsed = ReplaceContentToolInputSchema.safeParse(input);
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
        const { paths: pathPatterns, operations } = parsed.data; // allowOutsideWorkspace comes from options
        // --- End Zod Validation ---
        const fileResults = [];
        let overallSuccess = true;
        let resolvedFilePaths = [];
        try {
            // Expand globs, ensuring paths are relative to workspaceRoot for security
            resolvedFilePaths = await glob(pathPatterns, {
                cwd: workspaceRoot,
                absolute: false, // Keep paths relative to cwd
                onlyFiles: true, // Only operate on files
                dot: true, // Include dotfiles
                ignore: ['**/node_modules/**', '**/.git/**'], // Sensible defaults
            });
            if (resolvedFilePaths.length === 0) {
                console.error('No files matched the provided paths/globs.'); // Log to stderr
                // Return success=true but empty results if no files match
                return { success: true, results: [], content: [] }; // Add content
            }
        }
        catch (globError) {
            console.error(`Error expanding glob patterns: ${globError.message}`);
            return { success: false, error: `Glob pattern error: ${globError.message}`, results: [], content: [] }; // Add content
        }
        for (const relativeFilePath of resolvedFilePaths) {
            const fullPath = path.resolve(workspaceRoot, relativeFilePath);
            let fileSuccess = true;
            let fileError;
            let totalReplacementsMade = 0;
            let contentChanged = false;
            let suggestion;
            // Double-check security (glob should handle this, but belt-and-suspenders)
            // Skip this check if allowOutsideWorkspace is true
            const relativeCheck = path.relative(workspaceRoot, fullPath);
            if (!options?.allowOutsideWorkspace && (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck))) {
                fileError = `Path validation failed: Matched file '${relativeFilePath}' is outside workspace root.`;
                console.error(fileError);
                fileSuccess = false;
                overallSuccess = false;
                const suggestion = `Ensure the path pattern '${pathPatterns.join(', ')}' does not resolve to paths outside the workspace.`;
                fileResults.push({ path: relativeFilePath, success: false, replacementsMade: 0, contentChanged: false, error: fileError, suggestion });
                continue; // Skip this file
            }
            try {
                const originalContent = await readFile(fullPath, 'utf-8');
                let currentContent = originalContent;
                for (const op of operations) {
                    let operationReplacements = 0;
                    let tempContent = '';
                    if (op.isRegex) {
                        try {
                            const regex = new RegExp(op.search, op.flags ?? '');
                            tempContent = currentContent.replace(regex, op.replace);
                            // Note: Counting regex replacements accurately can be tricky without global flag + matchAll
                            // This simple check assumes at least one replacement if content changed.
                            if (tempContent !== currentContent) {
                                operationReplacements = 1; // Simplistic count for now
                            }
                        }
                        catch (e) {
                            throw new Error(`Invalid regex '${op.search}': ${e.message}`);
                        }
                    }
                    else {
                        // Simple text replacement
                        const searchString = op.search;
                        // Count occurrences before replacing
                        operationReplacements = currentContent.split(searchString).length - 1;
                        if (operationReplacements > 0) {
                            tempContent = currentContent.replaceAll(searchString, op.replace);
                        }
                        else {
                            tempContent = currentContent; // No change
                        }
                    }
                    if (tempContent !== currentContent) {
                        currentContent = tempContent;
                        totalReplacementsMade += operationReplacements; // Add (potentially inaccurate regex) count
                    }
                } // End operations loop
                // Write file only if content actually changed
                if (currentContent !== originalContent) {
                    await writeFile(fullPath, currentContent, 'utf-8'); // Use validated path
                    contentChanged = true;
                    console.error(`Applied ${totalReplacementsMade} replacement(s) to ${relativeFilePath}.`); // Log to stderr
                }
                else {
                    console.error(`No replacements needed for ${relativeFilePath}.`); // Log to stderr
                }
            }
            catch (e) {
                fileSuccess = false;
                overallSuccess = false;
                fileError = `Error processing file '${relativeFilePath}': ${e.message}`;
                console.error(fileError);
                // let suggestion: string | undefined; // Already declared above
                if (e.code === 'ENOENT') {
                    suggestion = `Ensure the file path '${relativeFilePath}' is correct and the file exists.`; // Assign to outer suggestion
                }
                else if (e.code === 'EACCES') {
                    suggestion = `Check read/write permissions for the file '${relativeFilePath}'.`; // Assign to outer suggestion
                }
                else if (e.message.includes('Invalid regex')) {
                    suggestion = 'Verify the regex pattern syntax in the operations.'; // Assign to outer suggestion
                }
                else {
                    suggestion = `Check file path, permissions, and operation details.`; // Assign to outer suggestion
                }
            }
            fileResults.push({
                path: relativeFilePath,
                success: fileSuccess,
                replacementsMade: totalReplacementsMade,
                contentChanged: contentChanged,
                error: fileError,
                // Use suggestion populated during validation or catch block
                suggestion: !fileSuccess ? suggestion : undefined,
            });
        } // End files loop
        return {
            success: overallSuccess,
            results: fileResults,
            // Add a default success message to content if overall successful
            content: overallSuccess
                ? [{ type: 'text', text: `Replace operation completed. Success: ${overallSuccess}` }]
                : [],
        };
    },
};
