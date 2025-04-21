/// <reference types="vitest" />
import { defineConfig as defineViteConfig, mergeConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig as defineVitestConfig } from 'vitest/config';
// Remove WASM plugin imports
// import wasm from 'vite-plugin-wasm';
// import topLevelAwait from 'vite-plugin-top-level-await';

const viteConfig = defineViteConfig({
  plugins: [
    tsconfigPaths(),
    // Remove WASM plugins
    // wasm(),
    // topLevelAwait()
  ],
  // Remove optimizeDeps for WASM
  // optimizeDeps: {
  //   exclude: [
  //       'web-tree-sitter',
  //       'tree-sitter-javascript/tree-sitter-javascript.wasm',
  //       'tree-sitter-typescript/tree-sitter-typescript.wasm',
  //       'tree-sitter-typescript/tree-sitter-tsx.wasm',
  //       'tree-sitter-python/tree-sitter-python.wasm',
  //   ]
  // }
});

const vitestConfig = defineVitestConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text'], // Only use text reporter for console output
      include: ['src/**/*.{ts,tsx}'], // Relative include path for per-package execution
      exclude: [
        'src/**/*.test.{ts,tsx}', // Exclude test files within src
        // Vitest defaults usually cover node_modules, dist etc.
      ],
    },
  },
});

export default mergeConfig(viteConfig, vitestConfig);
