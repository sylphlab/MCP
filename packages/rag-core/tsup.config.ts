import { defineConfig } from 'tsup';
import { execSync } from 'node:child_process'; // Need execSync again

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
  // Restore onSuccess hook to run the copy script
  onSuccess: async () => {
    console.log('Build successful, executing WASM copy script...');
    try {
      // Execute the copy script (ensure path is correct relative to package root)
      execSync('node ../../scripts/copy-wasm.cjs', { stdio: 'inherit' });
      console.log('WASM copy script finished successfully.');
    } catch (error) {
      console.error('WASM copy script failed:', error);
      throw error; // Fail the build if copy fails
    }
  },
});