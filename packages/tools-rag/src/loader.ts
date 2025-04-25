import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import ignore from 'ignore'; // Re-import ignore package
import type { Ignore } from 'ignore'; // Import type
import type { Document } from './types.js';

// Removed gitignoreInstance variable

/**
 * Reads ignore patterns from .gitignore and returns them as an array.
 * Includes default patterns.
 * @param projectRoot The root directory of the project.
 */
async function getIgnorePatterns(projectRoot: string): Promise<string[]> {
  // Add ./ prefix for potentially better fast-glob compatibility?
  const defaultIgnores = ['./node_modules/**', './.git/**', './dist/**'];
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
      // .gitignore not found, ignore silently and return defaults
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
      combinedIgnorePatterns.push('./node_modules/**', './.git/**', './dist/**');
  }
  // Remove duplicates and ensure patterns are valid
  combinedIgnorePatterns = [...new Set(combinedIgnorePatterns)].filter(p => typeof p === 'string' && p.trim() !== '');

  // Determine patterns to search for (defaults to all if includePatterns is empty)
  const searchPatterns = includePatterns && includePatterns.length > 0 ? includePatterns : ['**/*'];

  // --- Add Logging ---
  console.log(`[loadDocuments] CWD: ${projectRoot}`);
  console.log(`[loadDocuments] Searching patterns: ${JSON.stringify(searchPatterns)}`);
  console.log(`[loadDocuments] Ignoring patterns: ${JSON.stringify(combinedIgnorePatterns)}`);
  // --- End Logging ---

  // Use fast-glob with combined patterns
  const files = await fg(searchPatterns, {
    cwd: projectRoot,
    dot: true, // Match dotfiles/folders
    ignore: combinedIgnorePatterns,
    absolute: false, // Get relative paths
    onlyFiles: true,
    // followSymbolicLinks: false, // Consider adding this
  });

  console.log(`[loadDocuments] Found ${files.length} files after fast-glob.`);

  // --- Secondary Filtering using 'ignore' package ---
  let finalFiles = files;
  if (respectGitignore) {
      try {
          const gitignorePath = path.join(projectRoot, '.gitignore');
          const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
          const ig = ignore.default().add(gitignoreContent); // Correct usage
          // Also add default ignores that might not be in .gitignore explicitly
          ig.add(['node_modules', '.git', 'dist']);
          // Add excludePatterns from config
          if (excludePatterns) {
              ig.add(excludePatterns);
          }

          finalFiles = files.filter(f => !ig.ignores(f));
          console.log(`[loadDocuments] Found ${finalFiles.length} files after applying 'ignore' filter.`);

      } catch (error: unknown) {
           if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
               console.log("[loadDocuments] .gitignore not found, skipping secondary 'ignore' filtering based on it.");
               // Still apply default/exclude patterns if gitignore not found? Maybe not needed if fast-glob handled defaults.
           } else {
               console.warn(`[loadDocuments] Error applying secondary 'ignore' filter: ${error instanceof Error ? error.message : error}`);
           }
      }
  }
   // Apply includePatterns filter if provided (only keep files matching include)
   if (includePatterns && includePatterns.length > 0) {
       const igInclude = ignore.default().add(includePatterns); // Correct usage
       finalFiles = finalFiles.filter(f => igInclude.ignores(f)); // Keep if it matches include
       console.log(`[loadDocuments] Found ${finalFiles.length} files after applying 'include' filter.`);
   }


  if (finalFiles.length > 0) {
      console.log(`[loadDocuments] First few final files: ${JSON.stringify(finalFiles.slice(0, 10))}`);
  }
  // --- End Secondary Filtering ---


  for (const relativePath of finalFiles) { // Iterate over the finally filtered list
    const absolutePath = path.join(projectRoot, relativePath);
    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stats = await fs.stat(absolutePath);
      loadedDocs.push({
        id: relativePath.replace(/\\/g, '/'), // Ensure consistent path separators
        content: content,
        metadata: {
          filePath: relativePath.replace(/\\/g, '/'), // Ensure consistent path separators
          createdAt: stats.birthtimeMs,
          lastModified: stats.mtimeMs,
          size: stats.size,
        },
      });
    } catch (readError: unknown) {
        // Log errors reading individual files but continue processing others
        console.warn(`[loadDocuments] Error reading file ${relativePath}: ${readError instanceof Error ? readError.message : readError}`);
    }
  }
  return loadedDocs;
}
