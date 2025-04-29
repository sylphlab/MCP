import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // Entry point of the package
  format: ['esm', 'cjs'], // Output formats: ESM and CommonJS
  dts: true, // Generate declaration files (.d.ts)
});