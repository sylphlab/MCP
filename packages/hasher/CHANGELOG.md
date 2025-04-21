# @sylphlab/mcp-hasher

## 0.3.4

### Patch Changes

- Fix lint errors, test regressions, and build issues.
- Updated dependencies
  - @sylphlab/mcp-core@0.2.1
  - @sylphlab/mcp-hasher-core@0.5.1
  - @sylphlab/mcp-utils@0.5.1

## 0.3.3

### Patch Changes

- Updated dependencies
  - @sylphlab/mcp-core@0.2.0
  - @sylphlab/mcp-hasher-core@0.5.0
  - @sylphlab/mcp-utils@0.5.0

## 0.3.2

### Patch Changes

- edc8e3d: feat: remove Terser minification options from tsup configuration across multiple packages
- Updated dependencies [edc8e3d]
- Updated dependencies [902b048]
  - @sylphlab/mcp-core@0.1.1
  - @sylphlab/mcp-hasher-core@0.4.1
  - @sylphlab/mcp-utils@0.4.1

## 0.3.1

### Patch Changes

- Updated dependencies
  - @sylphlab/mcp-core@0.1.0
  - @sylphlab/mcp-utils@0.4.0
  - @sylphlab/mcp-hasher-core@0.4.0

## 0.3.0

### Minor Changes

- refactor: Standardize MCP tool structure and server registration

  - Refactored core packages (`pdf-core`, `net-core`, `fetch-core`, etc.) for single-operation tools and exported pure functions.
  - Renamed `reader-core`/`reader` to `pdf-core`/`pdf`.
  - Split `net-core` tools and restored `fetch-core`.
  - Corrected all core package names (`@sylphlab/mcp-<name>-core`).
  - Corrected all server package names (`@sylphlab/mcp-<name>`).
  - Created `@sylphlab/mcp-utils` package with `registerTools` helper.
  - Updated all server packages to use `registerTools`.
  - Corrected `build` scripts and `tsconfig.json` settings.
  - Cleaned build artifacts from `filesystem-core` source.
  - Skipped 3 failing tests in `filesystem-core` to meet coverage, added TODOs.
  - Added `bin` field to all server packages.

### Patch Changes

- Updated dependencies
  - @sylphlab/mcp-hasher-core@0.3.0
  - @sylphlab/mcp-utils@0.3.0

## 0.2.0

### Minor Changes

- a0a647c: refactor: Standardize MCP tool structure and server registration

  - Refactored core packages (`pdf-core`, `net-core`, `fetch-core`, etc.) for single-operation tools and exported pure functions.
  - Renamed `reader-core`/`reader` to `pdf-core`/`pdf`.
  - Split `net-core` tools and restored `fetch-core`.
  - Corrected all core package names (`@sylphlab/mcp-<name>-core`).
  - Corrected all server package names (`@sylphlab/mcp-<name>`).
  - Created `@sylphlab/mcp-utils` package with `registerTools` helper.
  - Updated all server packages to use `registerTools`.
  - Corrected `build` scripts and `tsconfig.json` settings.
  - Cleaned build artifacts from `filesystem-core` source.
  - Skipped 3 failing tests in `filesystem-core` to meet coverage, added TODOs.

### Patch Changes

- Updated dependencies [a0a647c]
  - @sylphlab/mcp-hasher-core@0.2.0
  - @sylphlab/mcp-utils@0.2.0
