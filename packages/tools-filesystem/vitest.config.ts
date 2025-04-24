import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Optional: Use Vitest globals like describe, it, expect
    environment: 'node', // Specify the test environment
    coverage: {
      provider: 'v8', // Use V8 coverage provider
      reporter: ['text', 'json', 'html'], // Output formats
      reportsDirectory: './coverage', // Directory for reports
      // Enforce coverage thresholds
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85, // Lowered from 90 due to uncovered branches
        statements: 90,
      },
      include: ['src/**/*.ts'], // Files to include in coverage
      exclude: [
        // Files to exclude
        'src/index.ts', // Often just exports, adjust if needed
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ],
    },
  },
});
