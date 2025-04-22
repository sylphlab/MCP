import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part
import glob from 'fast-glob';
import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SearchContentToolInput, searchContentTool } from './searchContentTool.js';
import type { FileSearchResult } from './searchContentTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock fast-glob
vi.mock('fast-glob', () => ({
  default: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT };
const allowOutsideOptions: McpToolExecuteOptions = { ...defaultOptions, allowOutsideWorkspace: true };

// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  const jsonPart = parts.find(part => part.type === 'json');
  if (jsonPart && jsonPart.value !== undefined) {
    try {
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  return undefined;
}
describe('searchContentTool', () => {
  const mockReadFile = vi.mocked(readFile);
  const mockGlob = vi.mocked(glob);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockGlob.mockResolvedValue([]); // Default to no files matched
    mockReadFile.mockResolvedValue(''); // Default to empty file
  });

  const createInput = (
    paths: string[],
    query: string,
    options: Partial<Omit<SearchContentToolInput, 'paths' | 'query'>> = {},
  ): SearchContentToolInput => ({
    paths,
    query,
    isRegex: options.isRegex ?? false,
    matchCase: options.matchCase ?? true,
    contextLinesBefore: options.contextLinesBefore ?? 0,
    contextLinesAfter: options.contextLinesAfter ?? 0,
    maxResultsPerFile: options.maxResultsPerFile,
  });

  it('should find simple text matches (case-sensitive default)', async () => {
    const filePath = 'file.txt';
    const content = 'Line 1: Hello\nLine 2: hello world\nLine 3: HELLO';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'Hello');

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.matches).toHaveLength(1);
    expect(itemResult.matches?.[0]?.lineNumber).toBe(1);
    expect(itemResult.matches?.[0]?.matchText).toBe('Hello');
  });

  it('should find simple text matches (case-insensitive)', async () => {
    const filePath = 'file.txt';
    const content = 'Line 1: Hello\nLine 2: hello world\nLine 3: HELLO';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'hello', { matchCase: false });

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.matches).toHaveLength(3);
    expect(itemResult.matches?.[0]?.lineNumber).toBe(1);
    expect(itemResult.matches?.[0]?.matchText).toBe('Hello');
    expect(itemResult.matches?.[1]?.lineNumber).toBe(2);
    expect(itemResult.matches?.[1]?.matchText).toBe('hello');
    expect(itemResult.matches?.[2]?.lineNumber).toBe(3);
    expect(itemResult.matches?.[2]?.matchText).toBe('HELLO');
  });

  it('should find regex matches', async () => {
    const filePath = 'file.txt';
    const content = 'Value: 123\nValue: 456\nIgnore: 789';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'Value: (\d+)', { isRegex: true });

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.matches).toBeDefined();
    expect(itemResult.matches).toBeDefined();
    expect(itemResult.matches).toBeDefined();
    expect(itemResult.matches).toHaveLength(2);
    expect(itemResult.matches?.[0]?.lineNumber).toBe(1);
    expect(itemResult.matches?.[0]?.matchText).toBe('Value: 123');
    expect(itemResult.matches?.[1]?.lineNumber).toBe(2);
    expect(itemResult.matches?.[1]?.matchText).toBe('Value: 456');
  });

  it('should include context lines', async () => {
    const filePath = 'file.txt';
    const content = 'Line 1\nLine 2 - Match\nLine 3\nLine 4';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'Match', { contextLinesBefore: 1, contextLinesAfter: 1 });

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.matches).toHaveLength(1);
    expect(itemResult.matches?.[0]?.lineNumber).toBe(2);
    expect(itemResult.matches?.[0]?.contextBefore).toEqual(['Line 1']);
    expect(itemResult.matches?.[0]?.contextAfter).toEqual(['Line 3']);
  });

  it('should limit results with maxResultsPerFile', async () => {
    const filePath = 'file.txt';
    const content = 'match\nmatch\nmatch';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'match', { maxResultsPerFile: 2 });

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.matches).toHaveLength(2);
  });

  it('should return empty matches if query not found', async () => {
    const filePath = 'file.txt';
    const content = 'Nothing to see here';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'missing');

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.matches).toBeUndefined(); // No matches array if empty
  });

  it('should search across multiple files', async () => {
    const files = ['file1.txt', 'file2.txt'];
    mockGlob.mockResolvedValue(files);
    mockReadFile.mockResolvedValueOnce('Match here').mockResolvedValueOnce('No match');
    const input = createInput(files, 'Match');

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);
    const itemResult1 = results?.[0];
    const itemResult2 = results?.[1];

    expect(itemResult1.success).toBe(true);
    expect(itemResult1.matches).toHaveLength(1);
    expect(itemResult2.success).toBe(true);
    expect(itemResult2.matches).toBeUndefined();
  });
    await expect(searchContentTool.execute(input as any, defaultOptions))
        .rejects.toThrow('Input validation failed: paths: paths array cannot be empty.');
  });

  it('should throw glob error', async () => {
    const globError = new Error('Invalid glob pattern');
    mockGlob.mockRejectedValue(globError);
    const input = createInput(['['], 'test');
    await expect(searchContentTool.execute(input, defaultOptions))
        .rejects.toThrow(`Glob pattern error: ${globError.message}`);
  });

  it('should handle file read error', async () => {
    const filePath = 'file.txt';
    mockGlob.mockResolvedValue([filePath]);
    const readError = new Error('Permission denied');
    mockReadFile.mockRejectedValue(readError);
    const input = createInput([filePath], 'test');

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Permission denied');
    expect(itemResult.suggestion).toEqual(expect.any(String));
  });

  it('should handle invalid regex error', async () => {
    const filePath = 'file.txt';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue('content');
    const input = createInput([filePath], '(', { isRegex: true }); // Invalid regex

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Invalid regex query:');
    expect(itemResult.suggestion).toContain('Verify the regex query syntax.');

  });

  it('should handle zero-length regex matches correctly', async () => {
    const filePath = 'file.txt';
    const fileContent = 'word1 word2';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(fileContent);
    const input = createInput([filePath], '\b', { isRegex: true }); // Word boundaries

    const _parts = await searchContentTool.execute(input, defaultOptions);
    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const _itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.matches).toBeDefined(); // Ensure matches array exists
    expect(itemResult.matches).toHaveLength(4); // Boundaries before/after each word
    expect(itemResult.matches?.[0]?.matchText).toBe('');
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('File not found');
    expect(itemResult.suggestion).toContain(`Ensure the file path '${filePath}' is correct`);
  });

  it('should provide suggestion for EACCES error', async () => {
    const filePath = 'no_access.txt';
    const eaccesError: NodeJS.ErrnoException = new Error('Permission denied');
    eaccesError.code = 'EACCES';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockRejectedValue(eaccesError);
    const input = createInput([filePath], 'test');

    const parts = await searchContentTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Permission denied');
    expect(itemResult.suggestion).toContain(`Check read permissions for the file '${filePath}'`);
  });

  it('should handle path validation failure for matched file', async () => {
    const filePath = '../outside.txt';
    mockGlob.mockResolvedValue([filePath]);
    const input = createInput([filePath], 'a');

    const parts = await searchContentTool.execute(input, defaultOptions); // allowOutsideWorkspace: false
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should succeed searching outside workspace when allowed', async () => {
    const filePath = '../outside.txt';
    const content = 'Match outside';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'outside');

    const parts = await searchContentTool.execute(input, allowOutsideOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.matches).toHaveLength(1);
    expect(itemResult.matches?.[0]?.matchText).toBe('outside');
    expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), 'utf-8');
  });

});