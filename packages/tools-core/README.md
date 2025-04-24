# @sylphlab/tools-core

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-core?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-core)

**The foundational building blocks for creating robust and consistent tools within the SylphLab ecosystem.**

This package provides the essential core types, interfaces, and utility functions, most notably `defineTool`, used across all SylphLab tool packages. It ensures a standardized approach to tool definition, making tools easier to create, manage, and integrate.

## Purpose

Creating tools that can be used by AI agents, MCP servers, or other automated systems requires clear definitions, including input/output schemas and metadata. `@sylphlab/tools-core` provides the framework for this:

*   **Standardization:** Defines common interfaces (`SylphTool`, `SylphToolDefinition`) that all tools should adhere to.
*   **Schema Definition:** Integrates with Zod for defining strongly-typed input and output schemas, ensuring data integrity.
*   **Utility Functions:** Offers helpers like `defineTool` to simplify the process of creating valid tool definitions.
*   **Consistency:** Ensures that tools developed across different packages share a common structure, facilitating integration and adaptation (e.g., via `@sylphlab/tools-adaptor-mcp` or `@sylphlab/tools-adaptor-vercel`).

## Key Features

*   **`defineTool` Utility:** A helper function to streamline the creation of `SylphTool` definitions, including name, description, Zod schemas, and the handler function.
*   **Core Types (`SylphTool`, `SylphToolDefinition`):** TypeScript interfaces defining the standard structure for all tools.
*   **Zod Integration:** Encourages the use of Zod for robust schema definition and validation.
*   **Foundation for Tool Ecosystem:** Serves as the base upon which all other `@sylphlab/tools-*` packages are built.

## Installation

This package is a fundamental dependency for other tool packages within the `mcp` monorepo. It's typically not used directly in end-user applications but is essential when developing new tool packages.

```bash
# From the root of the monorepo, when creating a new tool package
pnpm add @sylphlab/tools-core --filter <your-new-tool-package-name>
```

## Usage: Defining a Tool

Here's a conceptual example of how `defineTool` is used:

```typescript
import { z } from 'zod';
import { defineTool } from '@sylphlab/tools-core';

// 1. Define Input Schema using Zod
const inputSchema = z.object({
  fileName: z.string().describe('The name of the file to create.'),
  content: z.string().optional().describe('Optional initial content for the file.'),
});

// 2. Define Output Schema using Zod
const outputSchema = z.object({
  success: z.boolean().describe('Whether the file was created successfully.'),
  filePath: z.string().optional().describe('The full path to the created file if successful.'),
  error: z.string().optional().describe('Error message if creation failed.'),
});

// 3. Define the Tool Handler Function
async function createFileHandler(input: z.infer<typeof inputSchema>) {
  try {
    // ... logic to create the file using input.fileName and input.content ...
    const fullPath = '/path/to/' + input.fileName; // Example path
    // Simulate success
    return { success: true, filePath: fullPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 4. Define the Tool using defineTool
export const createFileTool = defineTool({
  name: 'createFile',
  description: 'Creates a new file with optional content.',
  inputSchema: inputSchema,
  outputSchema: outputSchema,
  handler: createFileHandler,
});

// Now `createFileTool` is a standard SylphTool object
// ready to be used by adapters or MCP servers.
```

## Why Use `@sylphlab/tools-core`?

*   **Consistency:** Ensures all tools follow the same structural pattern.
*   **Type Safety:** Leverages TypeScript and Zod for robust definitions.
*   **Reusability:** Core logic defined once can be adapted for multiple platforms (MCP, Vercel AI, etc.).
*   **Maintainability:** Standardized definitions make the tool ecosystem easier to understand and maintain.

## Dependencies

*   `zod`: The cornerstone for schema definition and validation.

---

Developed by Sylph Lab.