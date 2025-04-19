import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  tsconfig: './tsconfig.json', // Specify tsconfig path
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  shims: true, // Add __dirname, __filename, etc. shims for ESM
  // If dependencies cause issues, consider 'noExternal' or 'external'
  // external: ['@modelcontextprotocol/sdk'], // Example if SDK causes issues
});