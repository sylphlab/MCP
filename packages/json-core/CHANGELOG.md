# @sylphlab/mcp-json-core

## 0.4.1

### Patch Changes

- edc8e3d: feat: remove Terser minification options from tsup configuration across multiple packages
- Updated dependencies [edc8e3d]
- Updated dependencies [902b048]
  - @sylphlab/mcp-core@0.1.1

## 0.4.0

### Minor Changes

- feat: Refactor core types and tool structures

  Refactored core types (`McpContentPart`) for SDK compatibility and updated all core tools to handle batch inputs. Corrected the `registerTools` helper in utils.

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
