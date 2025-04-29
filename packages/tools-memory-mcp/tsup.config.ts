import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'], // MCP servers typically run as ESM
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Banner to add #!/usr/bin/env node for the executable
  banner: {
    js: '#!/usr/bin/env node',
  },
});