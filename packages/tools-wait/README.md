# @sylphlab/tools-wait

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-wait?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-wait)

**Core logic for introducing delays in execution.**

This package provides the underlying logic and tool definition for a simple "wait" or "delay" tool, designed using `@sylphlab/tools-core`. It serves as the foundation for `@sylphlab/tools-wait-mcp`.

## Purpose

Sometimes, it's necessary to pause execution for a specific duration within an automated workflow or agent process. This might be needed to wait for an asynchronous operation to complete elsewhere, to adhere to rate limits, or simply to introduce a deliberate pause. This package offers a standardized tool for this purpose.

## Tools Provided

*   `waitTool`: Pauses execution for a specified duration.
    *   Accepts the duration in milliseconds (or potentially other units like seconds).
    *   Resolves after the specified time has elapsed.

## Key Features

*   **Simple Delay:** Provides a straightforward way to pause execution.
*   **Configurable Duration:** Allows specifying the wait time.
*   **Standardized Definition:** Uses the `SylphTool` structure from `@sylphlab/tools-core`.
*   **Promise-Based:** Uses `setTimeout` wrapped in a Promise for asynchronous waiting.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, mainly as a dependency for `@sylphlab/tools-wait-mcp`.

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-wait --filter <your-package-name>
```

## Usage (Conceptual)

The tool definition is typically consumed by adapters or MCP server implementations.

```typescript
import { waitTool } from '@sylphlab/tools-wait';
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using the tool definition directly
async function runWait() {
  const input = { durationMs: 2000 }; // Wait for 2 seconds
  // Validate input against waitTool.inputSchema...
  console.log('Waiting...');
  const output = await waitTool.handler(input);
  // Validate output against waitTool.outputSchema...
  if (output.success) {
    console.log('Wait finished.');
  }
}

// Example: Adapting for MCP
const mcpWaitTool = adaptToolToMcp(waitTool);

// This adapted definition would then be used to create the MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides `defineTool` and core types.
*   `zod`: For input/output schema definition and validation.

---

Developed by Sylph Lab.