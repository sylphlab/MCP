import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
// Removed 'ignore' package import
import type { Document } from './types.js';

// Removed gitignoreInstance variable

/**
 * Reads ignore patterns from .gitignore and returns them as an array.
 * Includes default patterns.
 * @param projectRoot The root directory of the project.
 */
async function getIgnorePatterns(projectRoot: string): Promise<string[]> {
  const defaultIgnores = ['node_modules/**', '.git/**', 'dist/**']; // Keep defaults
  const gitignorePath = path.join(projectRoot, '.gitignore');
  try {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    const customIgnores = gitignoreContent
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '' && !line.startsWith('#'));
    return [...defaultIgnores, ...customIgnores];
  } catch (error: unknown) {
    // Check if error is an object with a code property before accessing it
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      // .gitignore not found, ignore silently and return defaults
    } else {
      // Log other errors (e.g., permission denied) but still return defaults
    }
    return defaultIgnores;
  }
}

/**
 * Loads all relevant documents from a project directory, respecting ignore patterns via fast-glob.
 * @param projectRoot The root directory of the project to scan.
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
  // Remove duplicates
  combinedIgnorePatterns = [...new Set(combinedIgnorePatterns)];

  // Determine patterns to search for (defaults to all if includePatterns is empty)
  const searchPatterns = includePatterns && includePatterns.length > 0 ? includePatterns : ['**/*'];

  // Use fast-glob with combined patterns
  const files = await fg(searchPatterns, {
    cwd: projectRoot,
    dot: true, // Match dotfiles/folders
    ignore: combinedIgnorePatterns,
    absolute: false,
    onlyFiles: true,
    // followSymbolicLinks: false, // Consider adding this
  });

  for (const relativePath of files) {
    // Iterate directly over filtered files
    const absolutePath = path.join(projectRoot, relativePath);
    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stats = await fs.stat(absolutePath);
      loadedDocs.push({
        id: relativePath,
        content: content,
        metadata: {
          filePath: relativePath,
          createdAt: stats.birthtimeMs,
          lastModified: stats.mtimeMs,
          size: stats.size,
        },
      });
    } catch (_error) {}
  }
  return loadedDocs;
}
