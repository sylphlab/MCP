import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'], // MCP servers typically run as ESM
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});