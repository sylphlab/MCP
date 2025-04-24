# @sylphlab/tools-pdf-mcp

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-pdf-mcp?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-pdf-mcp)

**Extract text and metadata from PDF documents remotely via the Model Context Protocol (MCP).**

This package provides a ready-to-run MCP server that exposes PDF processing functionalities, primarily text extraction, based on the tools defined in `@sylphlab/tools-pdf`.

## Purpose

This server allows MCP clients (like AI agents, RAG systems, or document processing workflows) to remotely extract content and information from PDF files. It acts as a secure interface, taking the core PDF processing logic from `@sylphlab/tools-pdf` (which uses `mupdf`), adapting it using `@sylphlab/tools-adaptor-mcp`, and serving it over the MCP standard (stdio). This enables clients to work with PDF content without needing local PDF parsing libraries or direct file access.

## Features

*   **MCP Server:** Implements the Model Context Protocol for tool execution.
*   **Exposes PDF Tools:** Provides tools (like `getTextTool`) for:
    *   Extracting full text content.
    *   Extracting text from specific pages or ranges.
    *   Retrieving document metadata.
    *   Getting the total page count.
*   **Handles Local Files:** Processes PDF files located within the server's working directory. (URL support might depend on the underlying `@sylphlab/tools-pdf` implementation).
*   **Structured Output:** Returns extracted data and metadata in a predictable JSON format.
*   **Executable:** Provides a binary (`mcp-pdf`) for easy execution.
*   **Secure:** Operates within the defined working directory context.

## Installation

This package is intended to be used as a standalone server.

**Using npm/pnpm/yarn (Recommended)**

Install as a dependency or globally:

```bash
# Globally
npm install -g @sylphlab/tools-pdf-mcp
# Or in a project
pnpm add @sylphlab/tools-pdf-mcp
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx` or the installed binary path:

```json
// Using npx
{
  "mcpServers": {
    "pdf-mcp": {
      "command": "npx",
      "args": ["@sylphlab/tools-pdf-mcp"],
      "name": "PDF Tools (npx)"
      // "cwd": "/path/to/target/project" // Set CWD if PDFs are relative to a project
    }
  }
}

// Or using global install path
{
  "mcpServers": {
    "pdf-mcp": {
      "command": "mcp-pdf", // If in PATH
      "name": "PDF Tools (Global)"
      // "cwd": "/path/to/target/project" // Set CWD if PDFs are relative to a project
    }
  }
}
```
*Note: Ensure the MCP host configuration specifies the correct `cwd` if PDF paths are relative to a specific project directory.*

**Using Docker (If Available)**

*(Requires a Docker image `sylphlab/tools-pdf-mcp:latest` to be published)*

```bash
docker pull sylphlab/tools-pdf-mcp:latest
```

Configure your MCP host, mounting the target project directory containing PDFs to `/app`:

```json
{
  "mcpServers": {
    "pdf-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i", // Essential for stdio communication
        "--rm",
        "-v",
        "/path/to/your/project:/app", // Mount the directory with PDFs
        "-w", "/app", // Set the working directory inside the container
        "sylphlab/tools-pdf-mcp:latest"
      ],
      "name": "PDF Tools (Docker)"
    }
  }
}
```

**Local Build (For Development)**

1.  **Build:** From the monorepo root: `pnpm build --filter @sylphlab/tools-pdf-mcp`
2.  **Configure MCP Host:**
    ```json
    {
      "mcpServers": {
        "pdf-mcp": {
          "command": "node",
          // Adjust path as needed
          "args": ["./packages/tools-pdf-mcp/dist/index.js"],
          "name": "PDF Tools (Local Build)"
          // "cwd": "/path/to/target/project" // Set CWD if PDFs are relative to a project
        }
      }
    }
    ```

## Usage

Once the server is running and configured in your MCP host, clients can send requests to extract information from PDF files within the server's working directory.

**MCP Request Example (Get text from page 2 and metadata):**

```json
{
  "tool_name": "getTextTool", // Tool name from @sylphlab/tools-pdf
  "arguments": {
    "items": [
      {
        "filePath": "./reports/annual_report.pdf", // Path relative to server CWD
        "pages": [2]
      }
    ],
    "includeMetadata": true,
    "includePageCount": true
  }
}
```

**Expected Response Snippet:**

```json
{
  "result": {
    "results": [
      {
        "source": "./reports/annual_report.pdf",
        "success": true,
        "data": {
          "page_texts": [
            { "page": 2, "text": "Text content from page 2..." }
          ],
          "metadata": { /* PDF metadata object */ },
          "num_pages": 50
        }
      }
    ]
  }
}
```

## Dependencies

*   `@modelcontextprotocol/sdk`: For creating the MCP server instance.
*   `@sylphlab/tools-adaptor-mcp`: To adapt the core tool definitions to MCP format.
*   `@sylphlab/tools-pdf`: Contains the actual logic for PDF processing using `mupdf`.
*   `@sylphlab/tools-core`: Provides the base tool definition structure.

---

Developed by Sylph Lab.