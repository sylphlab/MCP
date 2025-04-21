import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true, // Ensure DTS is true
  tsconfig: './tsconfig.json',
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node18', // Specify target environment
});
