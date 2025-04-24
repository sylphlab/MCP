# @sylphlab/tools-base64

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-base64?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-base64)

**Core functions for Base64 encoding and decoding.**

This package provides the underlying logic and tool definitions for performing Base64 operations, designed using `@sylphlab/tools-core`. It serves as the foundation for the corresponding MCP server package (`@sylphlab/tools-base64-mcp`).

## Purpose

Base64 is a common encoding scheme used to represent binary data in an ASCII string format. This package offers standardized tools for:

1.  **Encoding:** Converting plain text or binary data (represented as a string) into its Base64 equivalent.
2.  **Decoding:** Converting a Base64 encoded string back into its original plain text format (assuming the original data was text).

These core functions are defined using the `defineTool` utility from `@sylphlab/tools-core`, ensuring consistency and reusability across different environments (like MCP servers or Vercel AI SDK integrations via adapters).

## Tools Provided

*(Based on typical functionality, specific tool names might differ)*

*   `encodeBase64Tool`: Takes a string input and returns its Base64 encoded representation.
*   `decodeBase64Tool`: Takes a Base64 encoded string and returns the decoded plain text string.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, particularly as a dependency for `@sylphlab/tools-base64-mcp`. If you need to use the core logic directly in another package within this repository:

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-base64 --filter <your-package-name>
```

## Usage (Conceptual)

The tools defined here are typically consumed by adapter packages or MCP server implementations.

```typescript
import { encodeBase64Tool, decodeBase64Tool } from '@sylphlab/tools-base64';
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using the tool definition directly (less common)
async function runEncode() {
  const input = { text: 'Hello World!' };
  // Validate input against encodeBase64Tool.inputSchema...
  const output = await encodeBase64Tool.handler(input);
  // Validate output against encodeBase64Tool.outputSchema...
  console.log(output.encodedText); // Output: SGVsbG8gV29ybGQh
}

// Example: Adapting for MCP (more common)
const mcpEncodeTool = adaptToolToMcp(encodeBase64Tool);
const mcpDecodeTool = adaptToolToMcp(decodeBase64Tool);

// These adapted definitions would then be used to create an MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides the `defineTool` function and core tool types.
*   `zod`: Used for defining the input and output schemas for the tools.

---

Developed by Sylph Lab.