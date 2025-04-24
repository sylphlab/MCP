import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // Entry point of the package
  format: ['esm'], // Output format (ES Module)
  dts: true, // Generate declaration files (.d.ts)
  splitting: false, // Disable code splitting for simpler output
  sourcemap: true, // Generate source maps
  clean: true, // Clean the output directory before building
  target: 'es2022', // Target environment
  platform: 'node', // Specify platform as node
});