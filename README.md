# MCP Tools Monorepo

[![Built with Turbo](https://img.shields.io/badge/Built%20with-Turbo-blue?style=for-the-badge&logo=turborepo)](https://turbo.build/)

This monorepo contains a collection of tools and utilities, many designed to work with the Model Context Protocol (MCP).

## Overview

The project is structured as a monorepo using pnpm workspaces and managed by Turborepo. It includes various packages providing functionalities ranging from filesystem operations and network requests to data handling (JSON, XML, Base64, PDF) and MCP adaptors.

## Packages

This repository includes the following packages:

*   **Core & Adaptors:**
    *   `packages/tools-core`: Core utilities and definitions for building tools.
    *   `packages/tools-adaptor-mcp`: Adaptor for integrating tools with MCP servers.
    *   `packages/tools-adaptor-vercel`: Adaptor for Vercel-specific functionalities (if applicable).
*   **Data Handling:**
    *   `packages/tools-base64` / `packages/tools-base64-mcp`: Base64 encoding/decoding tools.
    *   `packages/tools-json` / `packages/tools-json-mcp`: JSON processing tools.
    *   `packages/tools-xml` / `packages/tools-xml-mcp`: XML processing tools.
    *   `packages/tools-pdf` / `packages/tools-pdf-mcp`: PDF text extraction tools.
*   **System & Network:**
    *   `packages/tools-filesystem` / `packages/tools-filesystem-mcp`: Filesystem operations tools.
    *   `packages/tools-net` / `packages/tools-net-mcp`: Network request tools (fetch, IP info, etc.).
    *   `packages/tools-hasher` / `packages/tools-hasher-mcp`: Hashing utilities.
*   **Specialized Tools:**
    *   `packages/tools-rag` / `packages/tools-rag-mcp`: Tools related to Retrieval-Augmented Generation (RAG).
    *   `packages/tools-wait` / `packages/tools-wait-mcp`: Tools for introducing delays or waiting.
    *   `packages/tools-fetch-mcp`: Specific MCP fetch tool (potentially distinct from tools-net).

*(Note: Packages ending with `-mcp` typically provide the MCP server implementation for the corresponding base tool package.)*

## Getting Started

### Prerequisites

*   Node.js (Check `.nvmrc` or `package.json` engines field if available)
*   pnpm (Version specified in `package.json`'s `packageManager` field)

### Installation

1.  Clone the repository:
    ```bash
    git clone <your-repo-url>
    cd mcp
    ```
2.  Install dependencies using pnpm:
    ```bash
    pnpm install
    ```

## Development

### Building Packages

To build all packages:

```bash
pnpm build
```

Or build continuously during development:

```bash
pnpm build:watch
```

### Linting

To check code style and quality using Biome:

```bash
pnpm lint
```

### Testing

To run tests for all packages (ensure packages are built first):

```bash
pnpm test
```

## Contributing

Contributions are welcome! Please refer to the `CONTRIBUTING.md` file (if available) for guidelines.

## License

This project is licensed under the ISC License. See the `LICENSE` file (if available) for details.