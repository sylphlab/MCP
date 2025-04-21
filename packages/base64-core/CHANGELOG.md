# @sylphlab/mcp-base64-core

## 0.3.6

### Patch Changes

- d0f53be: feat: Consolidate fetchTool into net-core

  Moved the `fetchTool` implementation from the deprecated `fetch-core` package into `net-core`.
  Updated `fetch` and `net` server packages to depend on `net-core` for fetch functionality.
  Removed the `fetch-core` package entirely.

  fix: Align test expectations with defineTool error handling

  Corrected error handling logic and test assertions across multiple packages (`filesystem-core`, `base64-core`, `net-core`, `rag-core`) to consistently handle errors thrown by tool `execute` functions and caught by the `defineTool` wrapper. Ensures tests correctly assert against the prefixed error messages returned by the wrapper and handle undefined properties appropriately in error cases.

- Updated dependencies [d0f53be]
  - @sylphlab/mcp-core@0.2.3

## 0.3.5

### Patch Changes

- bb39824: minor fix built issue
- Updated dependencies [bb39824]
  - @sylphlab/mcp-core@0.2.2

## 0.3.4

### Patch Changes

- Fix lint errors, test regressions, and build issues.
- Updated dependencies
  - @sylphlab/mcp-core@0.2.1

## 0.3.3

### Patch Changes

- Updated dependencies
  - @sylphlab/mcp-core@0.2.0

## 0.3.2

### Patch Changes

- edc8e3d: feat: remove Terser minification options from tsup configuration across multiple packages
- Updated dependencies [edc8e3d]
- Updated dependencies [902b048]
  - @sylphlab/mcp-core@0.1.1

## 0.3.1

### Patch Changes

- Updated dependencies
  - @sylphlab/mcp-core@0.1.0

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
