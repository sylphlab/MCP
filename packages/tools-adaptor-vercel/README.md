# @sylphlab/tools-adaptor-vercel

[![NPM version](https://img.shields.io/npm/v/@sylphlab/tools-adaptor-vercel?style=flat-square)](https://www.npmjs.com/package/@sylphlab/tools-adaptor-vercel)

**Integrate SylphLab Tools with the Vercel AI SDK seamlessly!**

This package provides adapter functions to convert tool definitions created using `@sylphlab/tools-core` into the format expected by the Vercel AI SDK (`ai` package), specifically for use with Large Language Models (LLMs) that support tool/function calling.

## Purpose

The Vercel AI SDK offers a powerful way to integrate generative AI features into applications. When using LLMs that support tool calling (like OpenAI's GPT models), the SDK requires tool definitions in a specific format (based on JSON Schema).

If you define your tools using `@sylphlab/tools-core`, this adapter bridges the gap by converting those definitions into the structure the Vercel AI SDK needs to pass to the LLM and to handle tool execution responses.

## Key Features

*   **Automatic Conversion:** Transforms `SylphTool` definitions into the `tools` format compatible with the Vercel AI SDK's `generateText` or similar functions.
*   **Schema Translation:** Leverages `zod-to-json-schema` to convert Zod schemas (used in `@sylphlab/tools-core`) into the JSON Schema format required by the Vercel AI SDK and underlying LLMs.
*   **Metadata Mapping:** Ensures tool names, descriptions, and parameter details are correctly formatted.
*   **Simplifies AI Integration:** Makes it easier to expose your existing SylphLab tools to LLMs via the Vercel AI SDK without manual definition rewriting.

## Installation

This package is primarily intended for internal use within the `mcp` monorepo. If you are building an application using the Vercel AI SDK and want to leverage tools defined in this repository, add it as a dependency:

```bash
# From the root of the monorepo
pnpm add @sylphlab/tools-adaptor-vercel --filter <your-vercel-ai-app-package>
```

## Usage (Conceptual)

You would typically use this adapter when preparing the `tools` option for a Vercel AI SDK function call:

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai'; // Or your preferred provider
import { adaptToolToVercel } from '@sylphlab/tools-adaptor-vercel';
import { filesystemTools } from '@sylphlab/tools-filesystem'; // Assuming this exports an array of SylphTool definitions

// Adapt SylphTool definitions for Vercel AI SDK
const vercelAiTools = {};
filesystemTools.forEach(tool => {
  vercelAiTools[tool.name] = adaptToolToVercel(tool);
});

async function main() {
  const { toolResults, text } = await generateText({
    model: openai('gpt-4-turbo'),
    prompt: 'Create a directory named "test-dir" and then list the contents of the current directory.',
    tools: vercelAiTools, // Pass the adapted tools here
  });

  // Handle toolResults if any tools were called...
  // Process the generated text...
  console.log(text);
}

main();
```

*(Note: The actual implementation depends on your specific Vercel AI SDK setup and how you handle tool execution.)*

## Dependencies

*   `ai`: The Vercel AI SDK.
*   `@sylphlab/tools-core`: Provides the base `SylphTool` definition format.
*   `zod`: Used for schema definition.
*   `zod-to-json-schema`: Used for converting Zod schemas to JSON Schema.

---

Developed by Sylph Lab.