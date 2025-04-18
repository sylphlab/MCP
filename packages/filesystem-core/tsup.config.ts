import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // Entry point
  format: ['esm', 'cjs'], // Output formats
  dts: false, // Disable dts generation for now to bypass build error
  splitting: false, // Keep as single file for simplicity, can enable later if needed
  sourcemap: true, // Generate source maps
  clean: true, // Clean output directory before build
  target: 'node18', // Target Node.js version (adjust if needed)
  outDir: 'dist', // Output directory
});