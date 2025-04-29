# @sylphlab/mcp-xml

## 0.5.0

### Minor Changes

- f422f02: rename tools

### Patch Changes

- Updated dependencies [f422f02]
  - @sylphlab/tools-adaptor-mcp@0.3.0
  - @sylphlab/tools-core@0.4.0
  - @sylphlab/tools-xml@0.7.0

## 0.4.1

### Patch Changes

- 001f90f: refactored
- Updated dependencies [001f90f]
  - @sylphlab/tools-adaptor-mcp@0.2.1
  - @sylphlab/tools-core@0.3.1
  - @sylphlab/tools-xml@0.6.1

## 0.4.0

### Minor Changes

- 852feae: refactor all tools

### Patch Changes

- Updated dependencies [852feae]
  - @sylphlab/tools-adaptor-mcp@0.2.0
  - @sylphlab/tools-core@0.3.0
  - @sylphlab/tools-xml@0.6.0

## 0.3.6

### Patch Changes

- Updated dependencies [d0f53be]
  - @sylphlab/mcp-core@0.2.3
  - @sylphlab/mcp-utils@0.5.3
  - @sylphlab/mcp-xml-core@0.5.3

## 0.3.5

### Patch Changes

- bb39824: minor fix built issue
- Updated dependencies [bb39824]
  - @sylphlab/mcp-core@0.2.2
  - @sylphlab/mcp-utils@0.5.2
  - @sylphlab/mcp-xml-core@0.5.2

## 0.3.4

### Patch Changes

- Fix lint errors, test regressions, and build issues.
- Updated dependencies
  - @sylphlab/mcp-core@0.2.1
  - @sylphlab/mcp-utils@0.5.1
  - @sylphlab/mcp-xml-core@0.5.1

## 0.3.3

### Patch Changes

- Updated dependencies
  - @sylphlab/mcp-core@0.2.0
  - @sylphlab/mcp-utils@0.5.0
  - @sylphlab/mcp-xml-core@0.5.0

## 0.3.2

### Patch Changes

- edc8e3d: feat: remove Terser minification options from tsup configuration across multiple packages
- Updated dependencies [edc8e3d]
- Updated dependencies [902b048]
  - @sylphlab/mcp-core@0.1.1
  - @sylphlab/mcp-utils@0.4.1
  - @sylphlab/mcp-xml-core@0.4.1

## 0.3.1

### Patch Changes

- Updated dependencies
  - @sylphlab/mcp-core@0.1.0
  - @sylphlab/mcp-utils@0.4.0
  - @sylphlab/mcp-xml-core@0.4.0

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
  - @sylphlab/mcp-utils@0.3.0
  - @sylphlab/mcp-xml-core@0.3.0

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
  - @sylphlab/mcp-utils@0.2.0
  - @sylphlab/mcp-xml-core@0.2.0
