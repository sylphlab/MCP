# @sylphlab/tools-hasher

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-hasher?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-hasher)

**Core logic for generating cryptographic hashes.**

This package provides the underlying logic and tool definitions for creating hashes of strings or files using common algorithms like MD5, SHA-256, and SHA-512. It's designed using `@sylphlab/tools-core` and serves as the foundation for `@sylphlab/tools-hasher-mcp`.

## Purpose

Hashing is essential for data integrity checks, checksums, password storage (though salted hashing is preferred for passwords), and various other cryptographic applications. This package offers standardized tools for generating these hashes. By defining them with `@sylphlab/tools-core`, the logic becomes reusable across different platforms like MCP servers.

## Tools Provided

*   `hashTool`: A versatile tool that takes a string input (or potentially a file path in future versions) and calculates its hash using a specified algorithm.
    *   Supports algorithms like `md5`, `sha256`, `sha512`.
    *   Returns the calculated hash as a hexadecimal string.

## Key Features

*   **Multiple Algorithms:** Supports common hashing algorithms (MD5, SHA-256, SHA-512).
*   **Standardized Definition:** Uses the `SylphTool` structure from `@sylphlab/tools-core`.
*   **Node.js Crypto:** Leverages the built-in `crypto` module in Node.js for reliable hash generation.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, mainly as a dependency for `@sylphlab/tools-hasher-mcp`.

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-hasher --filter <your-package-name>
```

## Usage (Conceptual)

The tool definitions are typically consumed by adapters or MCP server implementations.

```typescript
import { hashTool } from '@sylphlab/tools-hasher';
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using the tool definition directly
async function runHash() {
  const input = { text: 'Hello World', algorithm: 'sha256' };
  // Validate input against hashTool.inputSchema...
  const output = await hashTool.handler(input);
  // Validate output against hashTool.outputSchema...
  if (output.success) {
    console.log(output.hash); // Output: a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e
  }
}

// Example: Adapting for MCP
const mcpHashTool = adaptToolToMcp(hashTool);

// This adapted definition would then be used to create the MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides `defineTool` and core types.
*   `zod`: For input/output schema definition and validation.

---

Developed by Sylph Lab.