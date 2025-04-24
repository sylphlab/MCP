# @sylphlab/mcp-pdf

MCP server providing PDF processing tools.

## Purpose

This package implements a runnable MCP server that exposes tools defined in `@sylphlab/mcp-pdf-core`.

Currently available tools:
- `getText`: Extracts text content from a PDF file.

## Usage

This server communicates via stdio when run directly (e.g., `node ./dist/index.js`). It uses the `@modelcontextprotocol/sdk` to handle MCP communication.