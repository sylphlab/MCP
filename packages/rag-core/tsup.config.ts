import { defineConfig } from 'tsup';
import { execSync } from 'node:child_process'; // Keep only execSync

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Disable tsup DTS generation, use tsc instead
  sourcemap: true,
  clean: true,
  splitting: false,
  onSuccess: async () => {
    console.log('Build successful, executing WASM copy script...');
    try {
      // Execute the dedicated copy script, inheriting stdio to see its logs/errors
      execSync('node ../../scripts/copy-wasm.mjs', { stdio: 'inherit' });
      console.log('WASM copy script finished successfully.');
    } catch (error) {
      console.error('WASM copy script failed:', error);
      // Re-throw the error to fail the build process
      throw error;
    }
  },
});