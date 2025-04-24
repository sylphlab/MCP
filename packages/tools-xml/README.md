# @sylphlab/tools-xml

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-xml?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-xml)

**Core logic for parsing and potentially building XML data.**

This package provides the underlying logic and tool definitions for working with XML (Extensible Markup Language) data. It's designed using `@sylphlab/tools-core` and serves as the foundation for `@sylphlab/tools-xml-mcp`.

## Purpose

XML remains a common format for configuration files, data exchange, and legacy systems. This package offers standardized tools for processing XML, essential for agents or systems needing to interact with XML-based data sources or formats. By defining these tools with `@sylphlab/tools-core`, the logic becomes reusable and adaptable.

## Tools Provided

*   `xmlTool` (or similar names like `parseXml`, `buildXml`): A tool or set of tools likely designed to handle:
    *   **Parsing:** Converting an XML string into a JavaScript object representation (often a nested structure reflecting the XML tags). May include options for handling attributes, namespaces, etc.
    *   **(Potentially) Building:** Converting a JavaScript object back into a well-formed XML string.

## Key Features

*   **XML Parsing:** Converts XML strings into traversable JavaScript objects.
*   **Standardized Definition:** Uses the `SylphTool` structure from `@sylphlab/tools-core`.
*   **(Potential) XML Building:** May offer functionality to construct XML strings from objects.
*   **Library Integration:** Likely utilizes a robust underlying XML parsing library (e.g., `fast-xml-parser`, though not explicitly listed as a dependency, it might be used internally or planned).

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, mainly as a dependency for `@sylphlab/tools-xml-mcp`.

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-xml --filter <your-package-name>
```

## Usage (Conceptual)

The tool definitions are typically consumed by adapters or MCP server implementations.

```typescript
import { xmlTool } from '@sylphlab/tools-xml'; // Name might vary
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using the tool definition directly (e.g., parsing)
async function runParseXml() {
  const input = { xmlString: '<root><item id="1">Value</item></root>' };
  // Validate input against the specific tool's inputSchema...
  const output = await xmlTool.handler(input); // Or specific parse handler
  // Validate output against the specific tool's outputSchema...
  if (output.success) {
    console.log(output.parsedObject); // Output: { root: { item: { _attributes: { id: '1' }, _text: 'Value' } } } (structure depends on parser)
  } else {
    console.error(output.error);
  }
}

// Example: Adapting for MCP
const mcpXmlTool = adaptToolToMcp(xmlTool); // Adapt the relevant tool(s)

// This adapted definition would then be used to create the MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides `defineTool` and core types.
*   `zod`: For input/output schema definition and validation.

---

Developed by Sylph Lab.