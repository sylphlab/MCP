# @sylphlab/mcp-pdf-core

Core logic and schemas for MCP tools related to PDF processing.

## Tools Provided

-   **`getTextTool`**: Extracts text content from a PDF file using MuPDF.

## Usage

This package provides the core `McpTool` definitions. The tool objects (e.g., `getTextTool`), Zod input schemas, core logic functions (e.g., `extractPdfText`), and TypeScript types are exported.

These can be imported and used directly or registered with an MCP server implementation, such as `@sylphlab/mcp-pdf`.