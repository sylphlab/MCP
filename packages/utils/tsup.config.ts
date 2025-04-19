import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true, // Generate .d.ts files
  splitting: false,
  sourcemap: true,
  clean: true, // Clean output directory before build
  target: 'node18', // Specify target environment
});