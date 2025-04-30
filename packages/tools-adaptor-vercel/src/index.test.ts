import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
// Import ToolDefinition and BaseContextSchema as values
import { defineTool, textPart, jsonPart, imagePart, audioPart, fileRefPart, type ToolExecuteOptions, type Part, BaseContextSchema, type ToolDefinition } from '@sylphlab/tools-core';
import { toVercelTool, toVercelTools } from './index';
import type { Tool as VercelTool } from 'ai'; // Import VercelTool type

// Mock ToolExecuteOptions - Remove runId, parentRunId, and signal
const mockOptions: ToolExecuteOptions = {
  workspaceRoot: '/mock/workspace', // Add workspaceRoot for context
};

// Mock Sylph Tools using ToolDefinition
const textTool = defineTool({
  name: 'textTool',
  description: 'Returns text',
  inputSchema: z.object({ query: z.string() }),
  contextSchema: BaseContextSchema, // Add context schema
  execute: async ({ args }) => [textPart(`You searched for: ${args.query}`)], // Use args
});

const jsonTool = defineTool({
  name: 'jsonTool',
  description: 'Returns JSON',
  inputSchema: z.object({}), // Define input schema even if empty
  contextSchema: BaseContextSchema, // Add context schema
  execute: async () => [jsonPart({ success: true, data: [1, 2, 3] }, z.any())],
});

const imageTool = defineTool({
  name: 'imageTool',
  description: 'Returns an image',
  inputSchema: z.object({}), // Define input schema
  contextSchema: BaseContextSchema, // Add context schema
  execute: async () => [imagePart('base64-encoded-image-data', 'image/png')],
});

const audioTool = defineTool({
  name: 'audioTool',
  description: 'Returns audio',
  inputSchema: z.object({}), // Define input schema
  contextSchema: BaseContextSchema, // Add context schema
  execute: async () => [audioPart('base64-encoded-audio-data', 'audio/mpeg')],
});

const fileRefTool = defineTool({
  name: 'fileRefTool',
  description: 'Returns a file reference',
  inputSchema: z.object({}), // Define input schema
  contextSchema: BaseContextSchema, // Add context schema
  execute: async () => [fileRefPart('/path/to/some/file.txt')],
});

const mixedTool = defineTool({
    name: 'mixedTool',
    description: 'Returns mixed parts',
    inputSchema: z.object({}), // Define input schema
    contextSchema: BaseContextSchema, // Add context schema
    execute: async () => [
        textPart('Some text'),
        jsonPart({ key: 'value' }, z.any()),
        imagePart('img-data', 'image/jpeg'),
        audioPart('audio-data', 'audio/wav'),
        fileRefPart('file.pdf'),
    ],
});


describe('toVercelTool', () => {
  it('should correctly map description and parameters', () => {
    const vercelTool = toVercelTool(textTool, mockOptions);
    expect(vercelTool.description).toBe(textTool.description);
    // Compare the shape of the parameters schema instead of the instance
    expect(vercelTool.parameters.shape).toEqual(textTool.inputSchema.shape);
  });

  it('should call the original execute function with correct arguments', async () => {
    const executeSpy = vi.spyOn(textTool, 'execute');
    const vercelTool = toVercelTool(textTool, mockOptions);
    const args = { query: 'hello' };

    // Vercel's execute takes only the args
    // Cast to any to bypass incorrect TS error about expected arguments
    await (vercelTool.execute as any)?.(args);

    // Expect execute to be called with { context, args }
    expect(executeSpy).toHaveBeenCalledWith({ context: mockOptions, args });
    executeSpy.mockRestore();
  });

  it('should map text Part correctly', async () => {
    const vercelTool = toVercelTool(textTool, mockOptions);
    // Vercel's execute returns the Part[] array now
    // Cast to any to bypass incorrect TS error about expected arguments
    const result = await (vercelTool.execute as any)?.({ query: 'test' });
    // The experimental_toToolResultContent maps the Part array returned by the *original* execute
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result ?? []); // Pass the result to mapping, handle potential undefined

    // The mapped content should match Vercel's expected structure
    expect(mappedContent).toEqual([{ type: 'text', text: 'You searched for: test' }]);
  });

  it('should map json Part correctly', async () => {
    const vercelTool = toVercelTool(jsonTool, mockOptions);
    // Cast to any to bypass incorrect TS error about expected arguments
    const result = await (vercelTool.execute as any)?.({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result ?? []); // Pass the result to mapping, handle potential undefined

    expect(mappedContent).toEqual([{ type: 'text', text: JSON.stringify({ success: true, data: [1, 2, 3] }, null, 2) }]);
  });

  it('should map image Part correctly (passthrough)', async () => {
    const vercelTool = toVercelTool(imageTool, mockOptions);
    // Cast to any to bypass incorrect TS error about expected arguments
    const result = await (vercelTool.execute as any)?.({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result ?? []); // Pass the result to mapping, handle potential undefined

    // The mapped content should pass image through
    expect(mappedContent).toEqual([{ type: 'image', data: 'base64-encoded-image-data', mimeType: 'image/png' }]);
  });

  it('should map audio Part correctly', async () => {
    const vercelTool = toVercelTool(audioTool, mockOptions);
    // Cast to any to bypass incorrect TS error about expected arguments
    const result = await (vercelTool.execute as any)?.({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result ?? []); // Pass the result to mapping, handle potential undefined

    // The mapped content should represent audio as text
    expect(mappedContent).toEqual([{ type: 'text', text: 'Audio file: base64-encoded-audio-data' }]);
  });

  it('should map fileRef Part correctly', async () => {
    const vercelTool = toVercelTool(fileRefTool, mockOptions);
    // Cast to any to bypass incorrect TS error about expected arguments
    const result = await (vercelTool.execute as any)?.({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result ?? []); // Pass the result to mapping, handle potential undefined

    // The mapped content should represent fileRef as text
    expect(mappedContent).toEqual([{ type: 'text', text: 'File reference: /path/to/some/file.txt' }]);
  });

  it('should map mixed Parts correctly', async () => {
    const vercelTool = toVercelTool(mixedTool, mockOptions);
    // Cast to any to bypass incorrect TS error about expected arguments
    const result = await (vercelTool.execute as any)?.({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result ?? []); // Pass the result to mapping, handle potential undefined

    // The mapped content includes all parts mapped according to the rules
    expect(mappedContent).toEqual([
        { type: 'text', text: 'Some text' },
        { type: 'text', text: JSON.stringify({ key: 'value' }, null, 2) },
        { type: 'image', data: 'img-data', mimeType: 'image/jpeg' },
        { type: 'text', text: 'Audio file: audio-data' },
        { type: 'text', text: 'File reference: file.pdf' },
    ]);
  });

  it('should return undefined from experimental_toToolResultContent if not defined', async () => { // Make test async
    const simpleTool = defineTool({
        name: 'simple',
        description: 'simple',
        inputSchema: z.object({}), // Add schema
        contextSchema: BaseContextSchema, // Add schema
        execute: async () => [textPart('simple text')]
    });
    // Simulate a Vercel tool structure without the experimental function
    const vercelTool = {
        description: simpleTool.description,
        parameters: z.object(simpleTool.inputSchema.shape), // Adapt parameters
        // Adapt execute call to match Vercel's expected signature (args only)
        execute: (args: any) => simpleTool.execute({ context: mockOptions, args }),
        // experimental_toToolResultContent is intentionally missing
    } as VercelTool<any, Part[]>; // Correct VercelTool generic type
    const result = [textPart('simple text')] as Part[];
    // Remove unused @ts-expect-error
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result);
    expect(mappedContent).toBeUndefined();
  });

});

describe('toVercelTools', () => {
  it('should return an empty array if input is empty', () => {
    const vercelTools = toVercelTools([], mockOptions);
    expect(vercelTools).toEqual([]);
  });

  it('should convert multiple SylphTools to VercelTools', () => {
    // Use ToolDefinition<any, any> to allow mixed schemas
    const sylphTools: ToolDefinition<any, any>[] = [textTool, jsonTool, imageTool];
    const vercelTools = toVercelTools(sylphTools, mockOptions);

    expect(vercelTools).toHaveLength(3);
    expect(vercelTools[0].description).toBe(textTool.description);
    expect(vercelTools[1].description).toBe(jsonTool.description);
    expect(vercelTools[2].description).toBe(imageTool.description);
    // Compare the shape of the parameters schema instead of the instance
    expect(vercelTools[0].parameters.shape).toEqual(textTool.inputSchema.shape);
    expect(vercelTools[1].parameters.shape).toEqual(jsonTool.inputSchema.shape);
    expect(vercelTools[2].parameters.shape).toEqual(imageTool.inputSchema.shape);
  });
});