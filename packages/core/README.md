# MCP Core Types (@sylphlab/mcp-core)

[![NPM Version](https://img.shields.io/npm/v/%40sylphlab%2Fmcp-core)](https://www.npmjs.com/package/@sylphlab/mcp-core)
[![MIT licensed](https://img.shields.io/npm/l/%40sylphlab%2Fmcp-core)](./LICENSE)

Shared TypeScript types and interfaces for Sylph Lab MCP packages.

This package provides common definitions, such as the `McpTool` and `BaseMcpToolOutput` interfaces, used by other `@sylphlab/mcp-*` tool libraries and servers.

## Installation

This package is intended for internal use within the `sylphlab/mcp` monorepo. Other packages should depend on it using the `workspace:*` protocol.

```bash
# Add to another workspace package
pnpm add @sylphlab/mcp-core@workspace:* --filter <your-package-name>
```

## Usage

Import types as needed:

```typescript
import { McpTool, BaseMcpToolOutput } from '@sylphlab/mcp-core';
// ... use types ...
```

## Development

- Build: `pnpm --filter @sylphlab/mcp-core build`