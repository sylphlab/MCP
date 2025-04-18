import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import glob from 'fast-glob'; // Import fast-glob
// --- Zod Schema for Input Validation ---
export const SearchContentToolInputSchema = z.object({
    paths: z.array(z.string({ required_error: 'Each path/glob must be a string' })
        .min(1, 'Path/glob cannot be empty'))
        .min(1, 'paths array cannot be empty'),
    query: z.string().min(1, 'query cannot be empty'),
    isRegex: z.boolean().optional().default(false),
    matchCase: z.boolean().optional().default(true), // Default to case-sensitive
    contextLinesBefore: z.number().int().min(0).optional().default(0),
    contextLinesAfter: z.number().int().min(0).optional().default(0),
    maxResultsPerFile: z.number().int().min(1).optional(),
    // allowOutsideWorkspace removed from schema
});
// --- Tool Definition (following SDK pattern) ---
export const searchContentTool = {
    name: 'searchContentTool',
    description: 'Searches for content within multiple files (supports globs).',
    inputSchema: SearchContentToolInputSchema,
    async execute(input, workspaceRoot, options) {
        // Zod validation
        const parsed = SearchContentToolInputSchema.safeParse(input);
        if (!parsed.success) {
            const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
                .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
                .join('; ');
            return {
                success: false,
                error: `Input validation failed: ${errorMessages}`,
                results: [], // Keep results for consistency
                content: [], // Add required content field
            };
        }
        const { paths: pathPatterns, query, isRegex, matchCase, contextLinesBefore, contextLinesAfter, maxResultsPerFile, } = parsed.data; // allowOutsideWorkspace comes from options
        // --- End Zod Validation ---
        const fileResults = [];
        let overallSuccess = true;
        let resolvedFilePaths = [];
        try {
            resolvedFilePaths = await glob(pathPatterns, {
                cwd: workspaceRoot,
                absolute: false,
                onlyFiles: true,
                dot: true,
                ignore: ['**/node_modules/**', '**/.git/**'],
            });
            if (resolvedFilePaths.length === 0) {
                console.error('No files matched the provided paths/globs.'); // Log to stderr
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
            const matches = [];
            let suggestion;
            // Double-check security
            // Skip this check if allowOutsideWorkspace is true
            const relativeCheck = path.relative(workspaceRoot, fullPath);
            if (!options?.allowOutsideWorkspace && (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck))) {
                fileError = `Path validation failed: Matched file '${relativeFilePath}' is outside workspace root.`;
                console.error(fileError); // Keep error log
                fileSuccess = false;
                overallSuccess = false;
                const suggestion = `Ensure the path pattern '${pathPatterns.join(', ')}' does not resolve to paths outside the workspace.`;
                fileResults.push({ path: relativeFilePath, success: false, error: fileError, suggestion });
                continue; // Skip this file
            }
            try {
                const content = await readFile(fullPath, 'utf-8');
                const lines = content.split(/\r?\n/);
                let fileMatchCount = 0;
                // Prepare search query/regex
                let searchRegex;
                let searchString = null;
                if (isRegex) {
                    try {
                        // Add 'g' flag for multiple matches per line, respect case sensitivity via 'i' flag
                        const flags = matchCase ? 'g' : 'gi';
                        searchRegex = new RegExp(query, flags);
                    }
                    catch (e) {
                        throw new Error(`Invalid regex query: ${e.message}`);
                    }
                }
                else {
                    searchString = query;
                    // Create regex for finding the string, respecting case sensitivity
                    const flags = matchCase ? 'g' : 'gi';
                    searchRegex = new RegExp(searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                }
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line === undefined)
                        continue; // Should not happen with split, but safety
                    let matchResult;
                    let searchIndex = 0;
                    // Find all matches on the current line
                    while ((matchResult = searchRegex.exec(line)) !== null) {
                        if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) {
                            break; // Stop searching this file if max results reached
                        }
                        const matchText = matchResult[0];
                        const lineNumber = i + 1; // 1-based line number
                        // Get context lines
                        const contextBefore = lines.slice(Math.max(0, i - contextLinesBefore), i);
                        const contextAfter = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLinesAfter));
                        matches.push({
                            lineNumber,
                            lineContent: line,
                            matchText,
                            contextBefore: contextLinesBefore > 0 ? contextBefore : undefined,
                            contextAfter: contextLinesAfter > 0 ? contextAfter : undefined,
                        });
                        fileMatchCount++;
                        // Prevent infinite loops for zero-length matches with global flag
                        if (matchResult.index === searchRegex.lastIndex) {
                            searchRegex.lastIndex++;
                        }
                        // Break if max results reached after adding this match
                        if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) {
                            break;
                        }
                    }
                    if (maxResultsPerFile && fileMatchCount >= maxResultsPerFile) {
                        break; // Stop searching lines in this file
                    }
                } // End line loop
            }
            catch (e) {
                fileSuccess = false;
                overallSuccess = false;
                fileError = `Error processing file '${relativeFilePath}': ${e.message}`;
                console.error(fileError); // Keep original error log too
                // let suggestion: string | undefined; // Already declared above
                if (e.code === 'ENOENT') {
                    suggestion = `Ensure the file path '${relativeFilePath}' is correct and the file exists.`; // Assign to outer suggestion
                }
                else if (e.code === 'EACCES') {
                    suggestion = `Check read permissions for the file '${relativeFilePath}'.`; // Assign to outer suggestion
                }
                else if (e.message.includes('Invalid regex')) {
                    suggestion = 'Verify the regex query syntax.'; // Assign to outer suggestion
                }
                else {
                    suggestion = `Check file path and permissions.`; // Assign to outer suggestion
                }
            }
            fileResults.push({
                path: relativeFilePath,
                success: fileSuccess,
                matches: matches.length > 0 ? matches : undefined, // Only include matches array if not empty
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
                ? [{ type: 'text', text: `Search operation completed. Success: ${overallSuccess}` }]
                : [],
        };
    },
};
