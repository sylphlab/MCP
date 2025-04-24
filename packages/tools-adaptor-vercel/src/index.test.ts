import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineTool, textPart, jsonPart, imagePart, audioPart, fileRefPart, type ToolExecuteOptions, type Part } from '@sylphlab/tools-core';
import { toVercelTool, toVercelTools } from './index';

// Mock ToolExecuteOptions
const mockOptions: ToolExecuteOptions = {
  runId: 'test-run-id',
  parentRunId: 'test-parent-run-id',
  signal: new AbortController().signal,
};

// Mock Sylph Tools
const textTool = defineTool({
  name: 'textTool',
  description: 'Returns text',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => [textPart(`You searched for: ${query}`)],
});

const jsonTool = defineTool({
  name: 'jsonTool',
  description: 'Returns JSON',
  execute: async () => [jsonPart({ success: true, data: [1, 2, 3] }, z.any())], // Added z.any() for schema
});

const imageTool = defineTool({
  name: 'imageTool',
  description: 'Returns an image',
  execute: async () => [imagePart('base64-encoded-image-data', 'image/png')],
});

const audioTool = defineTool({
  name: 'audioTool',
  description: 'Returns audio',
  execute: async () => [audioPart('base64-encoded-audio-data', 'audio/mpeg')],
});

const fileRefTool = defineTool({
  name: 'fileRefTool',
  description: 'Returns a file reference',
  execute: async () => [fileRefPart('/path/to/some/file.txt')],
});

const mixedTool = defineTool({
    name: 'mixedTool',
    description: 'Returns mixed parts',
    execute: async () => [
        textPart('Some text'),
        jsonPart({ key: 'value' }, z.any()), // Added z.any() for schema
        imagePart('img-data', 'image/jpeg'),
        audioPart('audio-data', 'audio/wav'),
        fileRefPart('file.pdf'),
    ],
});


describe('toVercelTool', () => {
  it('should correctly map description and parameters', () => {
    const vercelTool = toVercelTool(textTool, mockOptions);
    expect(vercelTool.description).toBe(textTool.description);
    expect(vercelTool.parameters).toBe(textTool.inputSchema);
  });

  it('should call the original execute function with correct arguments', async () => {
    const executeSpy = vi.spyOn(textTool, 'execute');
    const vercelTool = toVercelTool(textTool, mockOptions);
    const args = { query: 'hello' };

    await vercelTool.execute(args);

    expect(executeSpy).toHaveBeenCalledWith(args, mockOptions);
    executeSpy.mockRestore();
  });

  it('should map text Part correctly', async () => {
    const vercelTool = toVercelTool(textTool, mockOptions);
    const result = await vercelTool.execute({ query: 'test' });
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result);

    expect(mappedContent).toEqual([{ type: 'text', text: 'You searched for: test' }]);
  });

  it('should map json Part correctly', async () => {
    const vercelTool = toVercelTool(jsonTool, mockOptions);
    const result = await vercelTool.execute({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result);

    expect(mappedContent).toEqual([{ type: 'text', text: JSON.stringify({ success: true, data: [1, 2, 3] }, null, 2) }]);
  });

  it('should map image Part correctly (passthrough)', async () => {
    const vercelTool = toVercelTool(imageTool, mockOptions);
    const result = await vercelTool.execute({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result);

    expect(mappedContent).toEqual([{ type: 'image', data: 'base64-encoded-image-data', mimeType: 'image/png' }]);
  });

  it('should map audio Part correctly', async () => {
    const vercelTool = toVercelTool(audioTool, mockOptions);
    const result = await vercelTool.execute({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result);

    expect(mappedContent).toEqual([{ type: 'text', text: 'Audio file: base64-encoded-audio-data' }]);
  });

  it('should map fileRef Part correctly', async () => {
    const vercelTool = toVercelTool(fileRefTool, mockOptions);
    const result = await vercelTool.execute({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result);

    expect(mappedContent).toEqual([{ type: 'text', text: 'File reference: /path/to/some/file.txt' }]);
  });

  it('should map mixed Parts correctly', async () => {
    const vercelTool = toVercelTool(mixedTool, mockOptions);
    const result = await vercelTool.execute({});
    const mappedContent = vercelTool.experimental_toToolResultContent?.(result);

    expect(mappedContent).toEqual([
        { type: 'text', text: 'Some text' },
        { type: 'text', text: JSON.stringify({ key: 'value' }, null, 2) },
        { type: 'image', data: 'img-data', mimeType: 'image/jpeg' },
        { type: 'text', text: 'Audio file: audio-data' },
        { type: 'text', text: 'File reference: file.pdf' },
    ]);
  });

  it('should return undefined from experimental_toToolResultContent if not defined', () => {
    const simpleTool = defineTool({
        name: 'simple',
        description: 'simple',
        execute: async () => [textPart('simple text')]
    });
    // Simulate a Vercel tool structure without the experimental function
    const vercelTool = {
        description: simpleTool.description,
        parameters: simpleTool.inputSchema,
        execute: (args: any) => simpleTool.execute(args, mockOptions),
        // experimental_toToolResultContent is intentionally missing
    };
    const result = [textPart('simple text')] as Part[];
    // @ts-expect-error - testing missing function
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
    const sylphTools = [textTool, jsonTool, imageTool];
    const vercelTools = toVercelTools(sylphTools, mockOptions);

    expect(vercelTools).toHaveLength(3);
    expect(vercelTools[0].description).toBe(textTool.description);
    expect(vercelTools[1].description).toBe(jsonTool.description);
    expect(vercelTools[2].description).toBe(imageTool.description);
    expect(vercelTools[0].parameters).toBe(textTool.inputSchema);
    expect(vercelTools[1].parameters).toBe(jsonTool.inputSchema);
    expect(vercelTools[2].parameters).toBe(imageTool.inputSchema);
  });
});