import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Stats } from 'node:fs'; // Import Stats type
import { z } from 'zod';
import { McpTool, BaseMcpToolOutput, McpToolInput } from '@sylphlab/mcp-core'; // Import base types

// --- Zod Schema for Input Validation ---
export const ListFilesToolInputSchema = z.object({
  paths: z.array(
      z.string({ required_error: 'Each path must be a string' })
       .min(1, 'Path cannot be empty')
    )
    .min(1, 'paths array cannot be empty'),
  recursive: z.boolean().optional().default(false),
  maxDepth: z.number().int().min(0).optional(), // 0 means only top level
  includeStats: z.boolean().optional().default(false),
});

// Infer the TypeScript type from the Zod schema
export type ListFilesToolInput = z.infer<typeof ListFilesToolInputSchema>;

// --- Output Types ---
export interface ListEntry {
    /** Name of the file or directory. */
    name: string;
    /** Relative path from the workspace root. */
    path: string;
    /** True if the entry is a directory. */
    isDirectory: boolean;
    /** True if the entry is a file. */
    isFile: boolean;
    /** Optional file system stats (if includeStats was true). */
    stat?: Stats;
}

export interface PathListResult {
    /** Whether listing was successful for this path. */
    success: boolean;
    /** Array of entries found within the path. */
    entries?: ListEntry[];
    /** Optional error message if listing failed for this path. */
    error?: string;
}

// Extend the base output type
export interface ListFilesToolOutput extends BaseMcpToolOutput {
  /** Overall operation success (true if at least one path was listed successfully). */
  // success: boolean; // Inherited
  /** Optional general error message if the tool encountered a major issue. */
  error?: string;
  /** Object where keys are the input paths and values are the listing results. */
  results: { [inputPath: string]: PathListResult };
}

// --- Helper Function for Recursive Listing ---
async function listDirectoryRecursive(
    dirPath: string,
    workspaceRoot: string,
    currentDepth: number,
    maxDepth: number | undefined,
    includeStats: boolean
): Promise<ListEntry[]> {
    let entries: ListEntry[] = [];
    const dirents = await readdir(dirPath, { withFileTypes: true });

    for (const dirent of dirents) {
        const fullPath = path.join(dirPath, dirent.name);
        const relativePath = path.relative(workspaceRoot, fullPath);
        let entryStat: Stats | undefined = undefined;

        if (includeStats) {
            try {
                // Use lstat to avoid following symlinks if stats are requested
                entryStat = await stat(fullPath);
            } catch (statError: any) {
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
                const subEntries = await listDirectoryRecursive(
                    fullPath,
                    workspaceRoot,
                    currentDepth + 1,
                    maxDepth,
                    includeStats
                );
                entries = entries.concat(subEntries);
            } catch (recursiveError: any) {
                 console.error(`Could not read subdirectory ${relativePath}: ${recursiveError.message}`);
                 // Include the directory entry itself even if listing its contents failed
            }
        }
    }
    return entries;
}


// --- Tool Definition (following SDK pattern) ---

export const listFilesTool: McpTool<typeof ListFilesToolInputSchema, ListFilesToolOutput> = {
  name: 'listFilesTool',
  description: 'Lists files and directories within one or more specified paths in the workspace.',
  inputSchema: ListFilesToolInputSchema,

  async execute(input: ListFilesToolInput, workspaceRoot: string): Promise<ListFilesToolOutput> {
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
    const { paths: inputPaths, recursive, maxDepth, includeStats } = parsed.data;
    // --- End Zod Validation ---

    const results: { [inputPath: string]: PathListResult } = {};
    let anySuccess = false;

    for (const inputPath of inputPaths) {
        const fullPath = path.resolve(workspaceRoot, inputPath);
        let pathSuccess = false;
        let pathEntries: ListEntry[] | undefined = undefined;
        let pathError: string | undefined;

        // --- Security Check ---
        const relativePathCheck = path.relative(workspaceRoot, fullPath);
        if (relativePathCheck.startsWith('..') || path.isAbsolute(relativePathCheck)) {
            pathError = `Path validation failed: Path must resolve within the workspace root ('${workspaceRoot}'). Relative Path: '${relativePathCheck}'`;
            console.error(pathError);
        } else {
            try {
                // Check if path exists and is a directory before reading
                const pathStat = await stat(fullPath);
                if (!pathStat.isDirectory()) {
                    throw new Error(`Path '${inputPath}' is not a directory.`);
                }

                if (recursive) {
                    pathEntries = await listDirectoryRecursive(fullPath, workspaceRoot, 0, maxDepth, includeStats);
                } else {
                    // Non-recursive: read only the top level
                    const dirents = await readdir(fullPath, { withFileTypes: true });
                    pathEntries = [];
                    for (const dirent of dirents) {
                         const entryFullPath = path.join(fullPath, dirent.name);
                         const entryRelativePath = path.relative(workspaceRoot, entryFullPath);
                         let entryStat: Stats | undefined = undefined;
                         if (includeStats) {
                             try {
                                 entryStat = await stat(entryFullPath);
                             } catch (statError: any) {
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

            } catch (e: any) {
                pathSuccess = false;
                pathError = `Error listing path '${inputPath}': ${e.message}`;
                console.error(pathError);
            }
        }

        results[inputPath] = {
            success: pathSuccess,
            entries: pathEntries,
            error: pathError,
        };
    }

    return {
      success: anySuccess, // True if at least one path succeeded
      results,
      content: [], // Add required content field
    };
  },
};