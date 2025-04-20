const path = require('node:path');
const fs = require('node:fs');

// __dirname is available directly in CJS
const workspaceRoot = path.resolve(__dirname, '..'); // Go up one level from scripts/

// Target directory should always be packages/rag-core/dist relative to workspace root
// NOTE: This script is intended to be run via `pnpm exec` from within packages/rag-core
// So, process.cwd() will be packages/rag-core, and targetDir is relative to that.
const targetDir = path.resolve(process.cwd(), 'dist');

// Define grammar packages and their expected WASM file names
const grammarPackages = {
  'tree-sitter-javascript': 'tree-sitter-javascript.wasm',
  'tree-sitter-typescript': 'tree-sitter-typescript.wasm', // Use the actual filename found
  'tree-sitter-tsx': 'tree-sitter-tsx.wasm', // Use the actual filename found (often part of ts package)
  'tree-sitter-python': 'tree-sitter-python.wasm',
  // 'tree-sitter-markdown': 'tree-sitter-markdown.wasm', // Add if needed
};

// Helper to find WASM using require.resolve relative to process.cwd()
const findWasmPath = (packageName, wasmName) => {
  try {
    // Resolve package path relative to the current working directory (packages/rag-core when using pnpm exec)
    const packageEntryPoint = require.resolve(packageName, { paths: [process.cwd()] });
    const packageDir = path.dirname(packageEntryPoint);
    console.log(`[copy-wasm] Resolved ${packageName} entry point directory: ${packageDir}`);

    // Check common locations relative to the resolved package directory
    // Check root of package first, as that's where we found them
    const rootWasmPath = path.join(path.dirname(require.resolve(`${packageName}/package.json`, { paths: [process.cwd()] })), wasmName);
     if (fs.existsSync(rootWasmPath)) {
         console.log(`[copy-wasm] Found WASM for ${packageName} at package root: ${rootWasmPath}`);
         return rootWasmPath;
     }

    // Fallback search (might be less reliable)
    const potentialFileNames = [wasmName, 'parser.wasm'];
    const potentialSubDirs = ['', 'wasm', 'tree-sitter', `prebuilds/${process.platform}-${process.arch}`];

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

    console.warn(`[copy-wasm] WASM file (${wasmName} or parser.wasm) not found for package ${packageName} in common locations relative to ${packageDir} or package root.`);
    return null;
  } catch (error) {
    console.error(`[copy-wasm] Error resolving package ${packageName} or finding WASM file ${wasmName}/parser.wasm:`, error);
    return null;
  }
};


// --- Main Execution ---
console.log('[copy-wasm] Starting WASM copy process...');
console.log(`[copy-wasm] Target Directory: ${targetDir}`);
console.log(`[copy-wasm] Assuming script is run from packages/rag-core via pnpm exec.`);


if (!fs.existsSync(targetDir)) {
  console.log(`[copy-wasm] Creating target directory: ${targetDir}`);
  fs.mkdirSync(targetDir, { recursive: true });
}

let allCopied = true;
// Special handling for tsx - it's part of tree-sitter-typescript
const tsPackageName = 'tree-sitter-typescript';
const tsxWasmName = 'tree-sitter-tsx.wasm';
const tsWasmName = 'tree-sitter-typescript.wasm';

for (const [packageName, wasmFileName] of Object.entries(grammarPackages)) {
  let sourcePath = null;
  let targetWasmName = wasmFileName; // Default target name

  if (packageName === 'tree-sitter-tsx') {
      // Find tsx wasm within the typescript package
      sourcePath = findWasmPath(tsPackageName, tsxWasmName);
      targetWasmName = tsxWasmName; // Ensure target is tsx.wasm
  } else if (packageName === 'tree-sitter-typescript') {
      // Find typescript wasm within the typescript package
      sourcePath = findWasmPath(tsPackageName, tsWasmName);
      targetWasmName = tsWasmName; // Ensure target is typescript.wasm
  } else {
      sourcePath = findWasmPath(packageName, wasmFileName);
  }


  if (sourcePath) {
    const actualWasmName = path.basename(sourcePath);
    // Use the specific target name (e.g., tree-sitter-tsx.wasm)
    const targetPath = path.join(targetDir, targetWasmName);
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[copy-wasm] Copied ${actualWasmName} to ${targetPath} (as ${targetWasmName})`);
    } catch (error) {
      console.error(`[copy-wasm] Failed to copy ${targetWasmName} from ${sourcePath}:`, error);
      allCopied = false;
    }
  } else {
    // Only fail if it wasn't the combined typescript package case we already handled
    if (packageName !== 'tree-sitter-typescript' || (wasmFileName !== tsxWasmName && wasmFileName !== tsWasmName)) {
        allCopied = false;
    }
  }
}

if (!allCopied) {
  console.error('[copy-wasm] One or more expected WASM files failed to copy. Check warnings above.');
  process.exit(1); // Exit with error code
} else {
  console.log('[copy-wasm] All WASM files copied successfully.');
  process.exit(0);
}