# @sylphlab/tools-pdf

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-pdf?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-pdf)

**Core logic for extracting text and potentially other content from PDF documents.**

This package provides the underlying logic and tool definitions for processing PDF files, primarily focusing on text extraction. It leverages the `mupdf` library for efficient parsing and is designed using `@sylphlab/tools-core`. This package serves as the foundation for `@sylphlab/tools-pdf-mcp`.

## Purpose

Extracting information from PDF documents is a common requirement for data processing pipelines, RAG systems, and AI agents. This package offers standardized tools for accessing PDF content, defined using `@sylphlab/tools-core` for consistency and reusability across different platforms.

## Tools Provided

*   `getTextTool` (or similar): Extracts text content from PDF files.
    *   Can extract text from the entire document.
    *   Can extract text from specific pages or page ranges.
    *   Can optionally retrieve PDF metadata (author, title, etc.).
    *   Can optionally retrieve the total page count.
*   *(Potential Future Tools):*
    *   Conversion to Markdown or other formats.
    *   Image extraction.

## Key Features

*   **Text Extraction:** Provides flexible options for retrieving text content.
*   **Metadata & Page Count:** Allows fetching document properties.
*   **Efficient Parsing:** Uses the `mupdf` library, known for its performance and accuracy.
*   **Standardized Definition:** Uses the `SylphTool` structure from `@sylphlab/tools-core`.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo, serving as a dependency for `@sylphlab/tools-pdf-mcp` and potentially other packages needing direct PDF processing logic.

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-pdf --filter <your-package-name>
```

## Usage (Conceptual)

The tool definitions are typically consumed by adapters or MCP server implementations.

```typescript
import { getTextTool } from '@sylphlab/tools-pdf';
import { adaptToolToMcp } from '@sylphlab/tools-adaptor-mcp'; // Example adapter

// Example: Using the tool definition directly
async function runGetText() {
  const input = {
    items: [
      { filePath: './path/to/document.pdf', pages: [1, 3] } // Extract pages 1 and 3
    ],
    includeMetadata: true
  };
  // Validate input against getTextTool.inputSchema...
  const output = await getTextTool.handler(input);
  // Validate output against getTextTool.outputSchema...
  if (output.results && output.results[0]?.success) {
    console.log('Metadata:', output.results[0].data.metadata);
    console.log('Page 1 Text:', output.results[0].data.page_texts.find(p => p.page === 1)?.text);
    console.log('Page 3 Text:', output.results[0].data.page_texts.find(p => p.page === 3)?.text);
  }
}

// Example: Adapting for MCP
const mcpPdfTool = adaptToolToMcp(getTextTool);

// This adapted definition would then be used to create the MCP server.
```

## Dependencies

*   `@sylphlab/tools-core`: Provides `defineTool` and core types.
*   `zod`: For input/output schema definition and validation.
*   `mupdf`: The core library used for parsing PDF documents.

---

Developed by Sylph Lab.