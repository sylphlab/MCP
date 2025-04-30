import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [ // Add this line
    '@sylphlab/tools-core', // Mark tools-core as external
  ], // Add this line
});