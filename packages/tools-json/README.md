# @sylphlab/tools-json

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-json?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-json)

**Core logic for JSON manipulation and processing.**

This package provides the underlying logic and tool definitions for working with JSON data, including parsing, stringifying, and potentially diffing/patching. It's designed using `@sylphlab/tools-core` and serves as the foundation for `@sylphlab/tools-json-mcp`.

## Purpose

JSON (JavaScript Object Notation) is a ubiquitous data format. This package offers standardized tools for common JSON operations, essential for agents or systems that need to process or transform JSON data. By defining these tools with `@sylphlab/tools-core`, the logic becomes reusable and adaptable for various platforms like MCP servers.

## Tools Provided

*   `jsonTool` (or similar names for specific operations like `parseJson`, `stringifyJson`, `diffJson`, `patchJson`): A tool or set of tools to handle:
    *   **Parsing:** Converting a JSON string into a JavaScript object/value.
    *   **Stringifying:** Converting a JavaScript object/value into a JSON string, potentially with formatting options.
    *   **(Potentially) Diffing:** Comparing two JSON objects and generating a description of the differences.
    *   **(Potentially) Patching:** Applying a set of changes (a patch) to a JSON object.

## Key Features

*   **Standard JSON Operations:** Covers parsing and stringifying.
*   **Advanced Capabilities (Potential):** May include JSON diff and patch functionality.
*   **Standardized Definition:** Uses the `SylphTool` structure from `@sylphlab/tools-core`.
*   **Robust Parsing/Stringifying:** Leverages standard JavaScript `JSON.parse()` and `JSON.stringify()`.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, mainly as a dependency for `@sylphlab/tools-json-mcp`.

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-json --filter <your-package-name>
```

## Usage (Conceptual)

The tool definitions are typically consumed by adapters or MCP server implementations.

```typescript
import { jsonTool } from '@sylphlab/tools-json'; // Name might vary
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using the tool definition directly (e.g., parsing)
async function runParseJson() {
  // Input might be structured differently depending on the tool definition
  const input = { jsonString: '{"key": "value", "number": 123}' };
  // Validate input against the specific tool's inputSchema...
  const output = await jsonTool.handler(input); // Or specific parse handler
  // Validate output against the specific tool's outputSchema...
  if (output.success) {
    console.log(output.parsedObject); // Output: { key: 'value', number: 123 }
  } else {
    console.error(output.error);
  }
}

// Example: Adapting for MCP
const mcpJsonTool = adaptToolToMcp(jsonTool); // Adapt the relevant tool(s)

// This adapted definition would then be used to create the MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides `defineTool` and core types.
*   `zod`: For input/output schema definition and validation.

---

Developed by Sylph Lab.