import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { readFile } from 'node:fs/promises'; // Use named import
import path from 'node:path';
import glob from 'fast-glob'; // Import fast-glob
import { searchContentTool, type SearchContentToolInput } from './searchContentTool';
import type { McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type


// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock fast-glob
vi.mock('fast-glob', () => ({
  default: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

describe('searchContentTool', () => {
  const mockReadFile = vi.mocked(readFile);
  const mockGlob = vi.mocked(glob);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockGlob.mockResolvedValue([]); // Default to no files matched
    mockReadFile.mockResolvedValue(''); // Default to empty file
  });

  // Define options objects including workspaceRoot
  const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false };
  const allowOutsideOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: true };

  // Helper
  // Use 'as any' to bypass strict type checking for the helper, as allowOutsideWorkspace is optional
  const createInput = (paths: string[], query: string, options: Partial<Omit<SearchContentToolInput, 'paths' | 'query' | 'allowOutsideWorkspace'>> = {}): SearchContentToolInput => ({
      paths,
      query,
      // Provide defaults matching Zod schema for type safety in tests
      isRegex: options.isRegex ?? false,
      matchCase: options.matchCase ?? true,
      contextLinesBefore: options.contextLinesBefore ?? 0,
      contextLinesAfter: options.contextLinesAfter ?? 0,
      maxResultsPerFile: options.maxResultsPerFile, // Optional, no default needed here
      // lineRange: options.lineRange, // TODO
  } as any);


  it('should find simple text matches (case-sensitive default)', async () => {
    const filePath = 'file.txt';
    const content = 'Line 1: Hello\nLine 2: hello world\nLine 3: HELLO';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'Hello'); // matchCase defaults to true

    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.matches).toHaveLength(1);
    expect(result.results[0]?.matches?.[0]?.lineNumber).toBe(1);
    expect(result.results[0]?.matches?.[0]?.matchText).toBe('Hello');
  });

  it('should find simple text matches (case-insensitive)', async () => {
    const filePath = 'file.txt';
    const content = 'Line 1: Hello\nLine 2: hello world\nLine 3: HELLO';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'hello', { matchCase: false });

    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.matches).toHaveLength(3);
    expect(result.results[0]?.matches?.[0]?.lineNumber).toBe(1);
    expect(result.results[0]?.matches?.[0]?.matchText).toBe('Hello');
     expect(result.results[0]?.matches?.[1]?.lineNumber).toBe(2);
    expect(result.results[0]?.matches?.[1]?.matchText).toBe('hello');
     expect(result.results[0]?.matches?.[2]?.lineNumber).toBe(3);
    expect(result.results[0]?.matches?.[2]?.matchText).toBe('HELLO');
  });

  it('should find regex matches', async () => {
     const filePath = 'file.txt';
    const content = 'Value: 123\nValue: 456\nIgnore: 789';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    // Regex to find numbers after "Value: "
    const input = createInput([filePath], 'Value: (\\d+)', { isRegex: true });

    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.matches).toHaveLength(2);
    expect(result.results[0]?.matches?.[0]?.lineNumber).toBe(1);
    expect(result.results[0]?.matches?.[0]?.matchText).toBe('Value: 123');
    expect(result.results[0]?.matches?.[1]?.lineNumber).toBe(2);
    expect(result.results[0]?.matches?.[1]?.matchText).toBe('Value: 456');
  });

  it('should include context lines', async () => {
    const filePath = 'file.txt';
    const content = 'Line 1\nLine 2 - Match\nLine 3\nLine 4';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'Match', { contextLinesBefore: 1, contextLinesAfter: 1 });

    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.matches).toHaveLength(1);
    expect(result.results[0]?.matches?.[0]?.lineNumber).toBe(2);
    expect(result.results[0]?.matches?.[0]?.contextBefore).toEqual(['Line 1']);
    expect(result.results[0]?.matches?.[0]?.contextAfter).toEqual(['Line 3']);
  });

  it('should limit results with maxResultsPerFile', async () => {
    const filePath = 'file.txt';
    const content = 'match\nmatch\nmatch';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'match', { maxResultsPerFile: 2 });

    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.matches).toHaveLength(2);
  });

  it('should return empty matches if query not found', async () => {
    const filePath = 'file.txt';
    const content = 'Nothing to see here';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(content);
    const input = createInput([filePath], 'missing');

    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.matches).toBeUndefined(); // Should be undefined or empty array
  });

  it('should search across multiple files', async () => {
    const files = ['file1.txt', 'file2.txt'];
    mockGlob.mockResolvedValue(files);
    mockReadFile
      .mockResolvedValueOnce('Match here')
      .mockResolvedValueOnce('No match');
    const input = createInput(files, 'Match');

    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.matches).toHaveLength(1);
    expect(result.results[1]?.success).toBe(true);
    expect(result.results[1]?.matches).toBeUndefined();
  });

  it('should return validation error for empty paths array', async () => {
    const input = { paths: [], query: 'test' }; // Invalid input
    const result = await searchContentTool.execute(input as any, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object
    expect(result.success).toBe(false);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('paths array cannot be empty');
  });

  it('should handle glob error', async () => {
    const globError = new Error('Invalid glob');
    mockGlob.mockRejectedValue(globError);
    const input = createInput(['['], 'test');
    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object
    expect(result.success).toBe(false);
    expect(result.error).toContain('Glob pattern error');
    // No suggestion at this level
  });

  it('should handle file read error', async () => {
    const filePath = 'file.txt';
    mockGlob.mockResolvedValue([filePath]);
    const readError = new Error('Permission denied');
    mockReadFile.mockRejectedValue(readError);
    const input = createInput([filePath], 'test');
    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object
    expect(result.success).toBe(false); // Overall fails
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Permission denied');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
  });

  it('should handle invalid regex error', async () => {
    const filePath = 'file.txt';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue('content');
    const input = createInput([filePath], '(', { isRegex: true }); // Invalid regex
    const result = await searchContentTool.execute(input, defaultOptions); // Pass options object
    expect(result.success).toBe(false); // Overall fails because file processing failed
    expect(result.error).toBeUndefined(); // No top-level error
    expect(result.results).toHaveLength(1); // Should have one result for the file
    expect(result.results[0]!.success).toBe(false); // File processing failed
    expect(result.results[0]!.error).toContain('Invalid regex query'); // Error from new RegExp()
    expect(result.results[0]!.suggestion).toEqual(expect.any(String));
  });

  it('should handle zero-length regex matches correctly', async () => {
    const filePath = 'file.txt';
    const fileContent = 'word1 word2';
    mockGlob.mockResolvedValue([filePath]); // Add glob mock
    mockReadFile.mockResolvedValue(fileContent);

    const input: SearchContentToolInput = {
      paths: [filePath],
      query: '\\b', // Match word boundaries (zero-length)
      isRegex: true,
      matchCase: true, // Add missing properties with defaults
      contextLinesBefore: 0,
      contextLinesAfter: 0,
    };

    const output = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results[0]?.success).toBe(true); // Check file success
    expect(output.results[0]?.matches).toHaveLength(4); // Boundaries before/after each word
    expect(output.results[0]?.matches?.[0]?.matchText).toBe('');
  });

  it('should provide suggestion for ENOENT error', async () => {
    const filePath = 'nonexistent.txt';
    const enoentError: NodeJS.ErrnoException = new Error('File not found');
    enoentError.code = 'ENOENT';
    mockGlob.mockResolvedValue([filePath]); // Add glob mock
    mockReadFile.mockRejectedValue(enoentError);

    const input: SearchContentToolInput = {
      paths: [filePath],
      query: 'test',
      isRegex: false, // Add missing properties with defaults
      matchCase: true,
      contextLinesBefore: 0,
      contextLinesAfter: 0,
    };

    const output = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(false); // Check overall success is false
    expect(output.results[0]?.success).toBe(false);
    expect(output.results[0]?.error).toContain('File not found'); // Check generic error message
    expect(output.results[0]?.suggestion).toContain(`Ensure the file path '${filePath}' is correct`); // Check suggestion for specific code
  });

  it('should provide suggestion for EACCES error', async () => {
    const filePath = 'no_access.txt';
    const eaccesError: NodeJS.ErrnoException = new Error('Permission denied');
    eaccesError.code = 'EACCES';
    mockGlob.mockResolvedValue([filePath]); // Add glob mock
    mockReadFile.mockRejectedValue(eaccesError);

    const input: SearchContentToolInput = {
      paths: [filePath],
      query: 'test',
      isRegex: false, // Add missing properties with defaults
      matchCase: true,
      contextLinesBefore: 0,
      contextLinesAfter: 0,
    };

    const output = await searchContentTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(false); // Check overall success is false
    expect(output.results[0]?.success).toBe(false);
    expect(output.results[0]?.error).toContain('Permission denied'); // Check generic error message
    expect(output.results[0]?.suggestion).toContain(`Check read permissions for the file '${filePath}'`); // Check suggestion for specific code
  });

  // TODO: Add tests for lineRange once implemented
});
