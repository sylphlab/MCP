import { defineConfig } from 'tsup';
// No longer need execSync

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true, // Re-enable DTS generation (will show errors)
  tsconfig: './tsconfig.json',
  sourcemap: true,
  clean: true,
  splitting: false,
  // Remove esbuildOptions for WASM loader
  // esbuildOptions(options) {
  //   options.loader = {
  //     ...options.loader,
  //     '.wasm': 'file',
  //   };
  // },
  // Remove onSuccess hook
});
