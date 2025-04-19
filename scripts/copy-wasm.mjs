import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Use createRequire to get a require function compatible with ES Modules
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target directory relative to the script location (scripts/ -> packages/rag-core/dist)
// Note: Script is run via `pnpm exec` from within packages/rag-core, so process.cwd() is packages/rag-core
const targetDir = path.resolve(process.cwd(), 'dist');

// Define grammar packages and their expected WASM file names
const grammarPackages = {
  'tree-sitter-javascript': 'tree-sitter-javascript.wasm',
  'tree-sitter-typescript': 'tree-sitter-typescript.wasm',
  'tree-sitter-python': 'tree-sitter-python.wasm',
};

// Helper to find WASM using require.resolve
// require.resolve should handle pnpm's structure correctly when run via `pnpm exec`
const findWasmPath = (packageName, wasmName) => {
  try {
    // Resolve package.json path relative to the *current working directory* (packages/rag-core)
    // require.resolve should search node_modules upwards correctly
    const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths: [process.cwd()] });
    const packageDir = path.dirname(packageJsonPath);

    // Check common locations relative to the resolved package directory
    const potentialFileNames = [wasmName, 'parser.wasm'];
    const potentialSubDirs = ['', 'wasm', 'tree-sitter', `prebuilds/${process.platform}-${process.arch}`]; // Keep checking common subdirs

    for (const subDir of potentialSubDirs) {
        for (const fileName of potentialFileNames) {
             if (fileName === 'parser.wasm' && wasmName === 'parser.wasm' && subDir !== '') continue;

             const fullPath = path.join(packageDir, subDir, fileName);
             try {
                 if (fs.existsSync(fullPath)) {
                     console.log(`[copy-wasm] Found WASM for ${packageName} at: ${fullPath}`);
                     return fullPath;
                 }
             } catch (e) { /* ignore errors for non-existent paths */ }
        }
    }

    console.warn(`[copy-wasm] WASM file (checked ${wasmName} and parser.wasm) not found for package ${packageName} in common locations relative to ${packageDir}.`);
    return null;
  } catch (error) {
    console.error(`[copy-wasm] Error resolving package ${packageName} or finding WASM file ${wasmName}/parser.wasm:`, error);
    return null;
  }
};


// --- Main Execution ---
console.log('[copy-wasm] Starting WASM copy process...');
console.log(`[copy-wasm] Target Directory: ${targetDir}`);

if (!fs.existsSync(targetDir)) {
  console.log(`[copy-wasm] Creating target directory: ${targetDir}`);
  fs.mkdirSync(targetDir, { recursive: true });
}

let allCopied = true;
for (const [packageName, wasmName] of Object.entries(grammarPackages)) {
  const sourcePath = findWasmPath(packageName, wasmName);
  if (sourcePath) {
    const actualWasmName = path.basename(sourcePath);
    const targetPath = path.join(targetDir, wasmName); // Use original expected name
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[copy-wasm] Copied ${actualWasmName} to ${targetPath} (as ${wasmName})`);
    } catch (error) {
      console.error(`[copy-wasm] Failed to copy ${wasmName} from ${sourcePath}:`, error);
      allCopied = false;
    }
  } else {
    allCopied = false;
  }
}

if (!allCopied) {
  console.error('[copy-wasm] One or more expected WASM files failed to copy. Check warnings above.');
  process.exit(1);
} else {
  console.log('[copy-wasm] All WASM files copied successfully.');
  process.exit(0);
}