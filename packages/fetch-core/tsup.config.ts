import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  tsconfig: './tsconfig.json', // Specify tsconfig path
  splitting: false,
  sourcemap: true,
  clean: true, // Clean output directory before build
  target: 'node18', // Specify target environment
});
