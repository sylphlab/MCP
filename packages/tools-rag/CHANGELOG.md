# @sylphlab/mcp-rag-core

## 0.2.1

### Patch Changes

- 001f90f: refactored
- Updated dependencies [001f90f]
  - @sylphlab/tools-core@0.3.1

## 0.2.0

### Minor Changes

- 852feae: refactor all tools

### Patch Changes

- Updated dependencies [852feae]
  - @sylphlab/tools-core@0.3.0

## 0.1.4

### Patch Changes

- d0f53be: feat: Consolidate fetchTool into net-core

  Moved the `fetchTool` implementation from the deprecated `fetch-core` package into `net-core`.
  Updated `fetch` and `net` server packages to depend on `net-core` for fetch functionality.
  Removed the `fetch-core` package entirely.

  fix: Align test expectations with defineTool error handling

  Corrected error handling logic and test assertions across multiple packages (`filesystem-core`, `base64-core`, `net-core`, `rag-core`) to consistently handle errors thrown by tool `execute` functions and caught by the `defineTool` wrapper. Ensures tests correctly assert against the prefixed error messages returned by the wrapper and handle undefined properties appropriately in error cases.

- Updated dependencies [d0f53be]
  - @sylphlab/mcp-core@0.2.3

## 0.1.3

### Patch Changes

- bb39824: minor fix built issue
- Updated dependencies [bb39824]
  - @sylphlab/mcp-core@0.2.2

## 0.1.2

### Patch Changes

- Fix lint errors, test regressions, and build issues.
- Updated dependencies
  - @sylphlab/mcp-core@0.2.1

## 0.1.1

### Patch Changes

- 6bdbda7: chore: Fixes various test failures in rag-core and updates rag test script.
