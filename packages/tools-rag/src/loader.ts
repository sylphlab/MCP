import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
// import ignore from 'ignore'; // Keep removed for now
// import type { Ignore } from 'ignore';
import type { Document } from './types.js';

/**
 * Reads ignore patterns from .gitignore and returns them as an array.
 * Includes default patterns.
 * @param projectRoot The root directory of the project.
 */
async function getIgnorePatterns(projectRoot: string): Promise<string[]> {
  // Use original default ignores without ./ prefix
  const defaultIgnores = ['node_modules/**', '.git/**', 'dist/**'];
  const gitignorePath = path.join(projectRoot, '.gitignore');
  try {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    const customIgnores = gitignoreContent
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '' && !line.startsWith('#'));
    // Ensure patterns starting with / are treated relative to root
    const processedIgnores = customIgnores.map(p => p.startsWith('/') ? p.substring(1) : p);
    return [...defaultIgnores, ...processedIgnores];
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      // .gitignore not found
    } else {
      console.warn(`[loadDocuments] Error reading .gitignore: ${error instanceof Error ? error.message : error}`);
    }
    return defaultIgnores;
  }
}

/**
 * Loads all relevant documents from a project directory, respecting ignore patterns via fast-glob.
 * @param projectRoot The root directory of the project to scan.
 * @param includePatterns Optional array of glob patterns to explicitly include.
 * @param excludePatterns Optional array of glob patterns to explicitly exclude (in addition to .gitignore).
 * @param respectGitignore Whether to read and apply .gitignore rules.
 * @returns An array of Document objects.
 */
export async function loadDocuments(
    projectRoot: string,
    includePatterns?: string[],
    excludePatterns?: string[],
    respectGitignore = true,
): Promise<Document[]> {
  const loadedDocs: Document[] = [];

  // Determine patterns to ignore
  let combinedIgnorePatterns: string[] = [...(excludePatterns || [])];
  if (respectGitignore) {
      const gitignorePatterns = await getIgnorePatterns(projectRoot); // Reads .gitignore + defaults
      combinedIgnorePatterns = [...combinedIgnorePatterns, ...gitignorePatterns];
  } else {
      // Add default ignores even if not respecting .gitignore
      combinedIgnorePatterns.push('node_modules/**', '.git/**', 'dist/**');
  }
  combinedIgnorePatterns = [...new Set(combinedIgnorePatterns)].filter(p => typeof p === 'string' && p.trim() !== '');

  // Determine patterns to search for
  const searchPatterns = includePatterns && includePatterns.length > 0 ? includePatterns : ['**/*'];

  // --- Logging ---
  console.log(`[loadDocuments] CWD: ${projectRoot}`);
  console.log(`[loadDocuments] Searching patterns: ${JSON.stringify(searchPatterns)}`);
  console.log(`[loadDocuments] Ignoring patterns: ${JSON.stringify(combinedIgnorePatterns)}`);
  // --- End Logging ---

  // Use fast-glob with combined patterns
  const files = await fg(searchPatterns, {
    cwd: projectRoot,
    dot: true,
    ignore: combinedIgnorePatterns,
    absolute: false, // Get relative paths
    onlyFiles: true,
  });

  // --- Logging ---
  console.log(`[loadDocuments] Found ${files.length} files after globbing.`);
  if (files.length > 0) {
      console.log(`[loadDocuments] First few files: ${JSON.stringify(files.slice(0, 10))}`);
  }
  // --- End Logging ---

  // Removed secondary filtering block

  for (const relativePath of files) { // Iterate over the list returned by fast-glob
    const absolutePath = path.join(projectRoot, relativePath);
    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stats = await fs.stat(absolutePath);
      loadedDocs.push({
        id: relativePath.replace(/\\/g, '/'), // Ensure consistent path separators
        content: content,
        metadata: {
          filePath: relativePath.replace(/\\/g, '/'),
          createdAt: stats.birthtimeMs,
          lastModified: stats.mtimeMs,
          size: stats.size,
        },
      });
    } catch (readError: unknown) {
        console.warn(`[loadDocuments] Error reading file ${relativePath}: ${readError instanceof Error ? readError.message : readError}`);
    }
  }
  return loadedDocs;
}