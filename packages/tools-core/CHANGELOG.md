# @sylphlab/mcp-core

## 0.3.1

### Patch Changes

- 001f90f: refactored

## 0.3.0

### Minor Changes

- 852feae: refactor all tools

## 0.2.3

### Patch Changes

- d0f53be: feat: Consolidate fetchTool into net-core

  Moved the `fetchTool` implementation from the deprecated `fetch-core` package into `net-core`.
  Updated `fetch` and `net` server packages to depend on `net-core` for fetch functionality.
  Removed the `fetch-core` package entirely.

  fix: Align test expectations with defineTool error handling

  Corrected error handling logic and test assertions across multiple packages (`filesystem-core`, `base64-core`, `net-core`, `rag-core`) to consistently handle errors thrown by tool `execute` functions and caught by the `defineTool` wrapper. Ensures tests correctly assert against the prefixed error messages returned by the wrapper and handle undefined properties appropriately in error cases.

## 0.2.2

### Patch Changes

- bb39824: minor fix built issue

## 0.2.1

### Patch Changes

- Fix lint errors, test regressions, and build issues.

## 0.2.0

### Minor Changes

- Refactor core packages for batch input, SDK type alignment, and utils helper correction.

## 0.1.1

### Patch Changes

- edc8e3d: feat: remove Terser minification options from tsup configuration across multiple packages
- 902b048: fix: minify

## 0.1.0

### Minor Changes

- feat: Refactor core types and tool structures

  Refactored core types (`McpContentPart`) for SDK compatibility and updated all core tools to handle batch inputs. Corrected the `registerTools` helper in utils.

## 0.0.1

### Patch Changes

- Fix build errors and refactor package structure.

  - Moved server logic from mcp-core to filesystem server.
  - Corrected exports in filesystem-core.
  - Resolved various TypeScript configuration issues.
