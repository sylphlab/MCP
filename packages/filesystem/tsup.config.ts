import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // Entry point for the server
  format: ['esm'], // Output format (ES Module)
  target: 'node18', // Target Node.js version (consistent with others)
  dts: false, // Generate declaration files using tsc --build instead
  sourcemap: true, // Generate source maps
  clean: true, // Clean the output directory before building
  splitting: false, // Keep output in a single file for server simplicity
  treeshake: true,
});