import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // Entry point for exporting types
  format: ['esm', 'cjs'], // Output formats
  tsconfig: './tsconfig.json', // Specify tsconfig at top level
  dts: true, // Generate declaration files (.d.ts)
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: 'terser', // Use Terser for minification
  terserOptions: {
    compress: true, // Enable compression
    mangle: true, // Enable mangling of variable names
  },
  target: 'node18',
  outDir: 'dist',
});