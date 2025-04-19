import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Use createRequire to get a require function compatible with ES Modules
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target directory relative to the script location (scripts/ -> packages/rag-core/dist)
const targetDir = path.resolve(__dirname, '../packages/rag-core/dist');

// Define grammar packages and their expected WASM file names
const grammarPackages = {
  'tree-sitter-javascript': 'tree-sitter-javascript.wasm',
  'tree-sitter-typescript': 'tree-sitter-typescript.wasm', // Grammar for .ts
  // 'tree-sitter-tsx': 'tree-sitter-tsx.wasm', // Removed - TS grammar often handles TSX
  'tree-sitter-python': 'tree-sitter-python.wasm',
  // '@tree-sitter-grammars/tree-sitter-markdown': 'tree-sitter-markdown.wasm', // Removed again
};

// Helper to find WASM using require.resolve (assuming hoisted node_modules)
const findWasmPath = (packageName, wasmName) => {
  try {
    let packagePath;
    let packageDir;

    // Resolve package.json path relative to the script's location
    packagePath = require.resolve(`${packageName}/package.json`, { paths: [path.resolve(__dirname, '..')] });
    packageDir = path.dirname(packagePath);

    // Check common locations relative to the resolved package directory, checking both wasmName and parser.wasm
    const potentialFileNames = [wasmName, 'parser.wasm'];
    const potentialSubDirs = ['', 'wasm', 'tree-sitter', `prebuilds/${process.platform}-${process.arch}`];

    for (const subDir of potentialSubDirs) {
        for (const fileName of potentialFileNames) {
             // Skip checking parser.wasm if it's the same as wasmName
             if (fileName === 'parser.wasm' && wasmName === 'parser.wasm' && subDir !== '') continue;

             const fullPath = path.join(packageDir, subDir, fileName);
             if (fs.existsSync(fullPath)) {
                 console.log(`[copy-wasm] Found WASM for ${packageName} at: ${fullPath}`);
                 return fullPath; // Return the full path of the file found
             }
        }
    }


    // Special check for tsx within typescript package (if needed, but tsx removed from list)
    // if (packageName === 'tree-sitter-tsx') { ... }


    console.warn(`[copy-wasm] WASM file (checked ${wasmName} and parser.wasm) not found for package ${packageName} in common locations relative to ${packageDir}.`);
    return null;
  } catch (error) {
    console.error(`[copy-wasm] Error resolving package ${packageName} or finding WASM file ${wasmName}/parser.wasm:`, error);
    return null; // Return null on error
  }
};


// --- Main Execution ---
console.log('[copy-wasm] Starting WASM copy process...');
if (!fs.existsSync(targetDir)) {
  console.log(`[copy-wasm] Creating target directory: ${targetDir}`);
  fs.mkdirSync(targetDir, { recursive: true });
}

let allCopied = true;
for (const [packageName, wasmName] of Object.entries(grammarPackages)) {
  const sourcePath = findWasmPath(packageName, wasmName); // Returns full path to found file or null
  if (sourcePath) {
    const actualWasmName = path.basename(sourcePath); // Get the actual filename found (e.g., parser.wasm)
    // Ensure target uses the original expected name for consistency in dist/
    const targetPath = path.join(targetDir, wasmName);
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[copy-wasm] Copied ${actualWasmName} to ${targetPath} (as ${wasmName})`);
    } catch (error) {
      console.error(`[copy-wasm] Failed to copy ${wasmName} from ${sourcePath}:`, error);
      allCopied = false;
    }
  } else {
    allCopied = false; // Mark as failure if any WASM is missing
  }
}

// Only exit with error if a file *listed in grammarPackages* failed to copy.
// Failures for files not listed (like the removed Markdown) are expected warnings.
if (!allCopied) {
  console.error('[copy-wasm] One or more expected WASM files failed to copy. Check warnings above.');
  process.exit(1);
} else {
  console.log('[copy-wasm] All WASM files copied successfully.');
  process.exit(0);
}