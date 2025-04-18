/// <reference types="vitest" />
import { defineConfig } from 'vite'; // Import from vite
import tsconfigPaths from 'vite-tsconfig-paths';
import type { UserConfig } from 'vitest/config'; // Import Vitest config type

// Cast the config object to satisfy both Vite and Vitest types
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Vitest specific config
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*-core/src/**/*.{ts,tsx}'],
      exclude: [
        'packages/**/src/**/*.test.{ts,tsx}',
        'packages/*-mcp/src/**/*.{ts,tsx}', // Exclude wrapper packages
        'packages/core/src/**/*.{ts,tsx}', // Exclude original core package for now
        'packages/filesystem/src/**/*.{ts,tsx}', // Exclude original fs package
        'packages/filesystem-core/src/**/*.{ts,tsx}', // Exclude original fs-core package
        // Exclude node_modules, dist, etc. (Vitest defaults usually cover this)
      ],
    },
  } as UserConfig['test'], // Cast the test config
});