import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part
import glob from 'fast-glob';
import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ReplaceContentToolInput,
  type ReplaceOperation,
  replaceContentTool,
} from './replaceContentTool.js';
import type { FileReplaceResult } from './replaceContentTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock fast-glob
vi.mock('fast-glob', () => ({
  default: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const defaultOptions: ToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT };
const allowOutsideOptions: ToolExecuteOptions = { ...defaultOptions, allowOutsideWorkspace: true };

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

// Helper to extract Text summary from parts
function getTextSummary(parts: Part[]): string | undefined {
    const textPart = parts.find(part => part.type === 'text');
    // Corrected property access from 'content' to 'value'
    return textPart?.value as string | undefined;
}


describe('replaceContentTool', () => {
  const mockReadFile = vi.mocked(readFile);
  const mockWriteFile = vi.mocked(writeFile);
  const mockGlob = vi.mocked(glob);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockGlob.mockResolvedValue([]); // Default to no files matched
    mockReadFile.mockResolvedValue(''); // Default to empty file
    mockWriteFile.mockResolvedValue(undefined); // Default to successful write
  });

  const createInput = (
    paths: string[],
    operations: ReplaceOperation[],
    dryRun?: boolean,
  ): ReplaceContentToolInput => ({ paths, operations, dryRun });

  it('should perform simple text replacement in one file', async () => {
    const filePath = 'file.txt';
    const initialContent = 'hello world, hello';
    const expectedContent = 'hi world, hi';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    // Added missing isRegex property
    const input = createInput([filePath], [{ search: 'hello', replace: 'hi', isRegex: false }], false); // dryRun: false

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);
    const summary = getTextSummary(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true);
    expect(itemResult?.path).toBe(filePath);
    expect(itemResult?.replacementsMade).toBe(2);
    expect(itemResult?.contentChanged).toBe(true);
    expect(itemResult?.dryRun).toBe(false);
    expect(itemResult?.error).toBeUndefined();

    expect(summary).toContain('1 matched file(s)');
    expect(summary).toContain('1 processed successfully');
    expect(summary).toContain('1 changed');

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, filePath),
      Buffer.from(expectedContent, 'utf-8'), // Expect buffer
    );
  });

  it('should perform regex replacement in one file', async () => {
    const filePath = 'file.txt';
    const initialContent = 'line 1\nline 2';
    const expectedContent = 'L1\nL2';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput(
      [filePath],
      [{ search: 'line (\\d)', replace: 'L$1', isRegex: true, flags: 'g' }],
      false // dryRun: false
    );

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true);
    expect(itemResult?.replacementsMade).toBe(2); // Regex matches twice
    expect(itemResult?.contentChanged).toBe(true);
    expect(itemResult?.dryRun).toBe(false);

    expect(mockWriteFile).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, filePath),
      Buffer.from(expectedContent, 'utf-8'),
    );
  });

  it('should perform replacements across multiple files from glob', async () => {
    const files = ['file1.txt', 'sub/file2.txt'];
    mockGlob.mockResolvedValue(files);
    mockReadFile.mockResolvedValueOnce('content A').mockResolvedValueOnce('content B');
    // Added missing isRegex property
    const input = createInput(['**/*.txt'], [{ search: 'content', replace: 'CONTENT', isRegex: false }], false);
    const expectedContent1 = 'CONTENT A';
    const expectedContent2 = 'CONTENT B';

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);
    const summary = getTextSummary(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);
    expect(results?.[0]?.success).toBe(true);
    expect(results?.[1]?.success).toBe(true);
    expect(summary).toContain('2 matched file(s)');
    expect(summary).toContain('2 processed successfully');
    expect(summary).toContain('2 changed');

    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, files[0]),
      Buffer.from(expectedContent1, 'utf-8'),
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, files[1]),
      Buffer.from(expectedContent2, 'utf-8'),
    );
  });

  it('should not write file if no replacements are made', async () => {
    const filePath = 'file.txt';
    const initialContent = 'no matches here';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    // Added missing isRegex property
    const input = createInput([filePath], [{ search: 'missing', replace: 'found', isRegex: false }], false);

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);
    const summary = getTextSummary(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1); // Implementation pushes result even if no change
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true);
    expect(itemResult?.replacementsMade).toBe(0);
    expect(itemResult?.contentChanged).toBe(false);
    expect(itemResult?.dryRun).toBe(false);

    expect(summary).toContain('1 matched file(s)');
    expect(summary).toContain('1 processed successfully');
    expect(summary).toContain('0 changed'); // Correct summary

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

   it('should perform a dry run correctly', async () => {
    const filePath = 'file.txt';
    const initialContent = 'hello world';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    // Added missing isRegex property
    const input = createInput([filePath], [{ search: 'hello', replace: 'hi', isRegex: false }], true); // dryRun: true

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);
    const summary = getTextSummary(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Dry run simulation is success
    expect(itemResult?.path).toBe(filePath);
    expect(itemResult?.replacementsMade).toBe(1); // Reports changes that *would* be made
    expect(itemResult?.contentChanged).toBe(true); // Reports content *would* change
    expect(itemResult?.dryRun).toBe(true);
    expect(itemResult?.error).toBeUndefined();

    expect(summary).toContain('1 matched file(s)');
    expect(summary).toContain('1 processed successfully');
    expect(summary).toContain('1 changed'); // Reports potential changes

    expect(mockWriteFile).not.toHaveBeenCalled(); // Write should not happen
  });


  it('should return success with empty results if no files match glob', async () => {
    mockGlob.mockResolvedValue([]); // No files matched
    // Added missing isRegex property
    const input = createInput(['*.nomatch'], [{ search: 'a', replace: 'b', isRegex: false }]);

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);
    const summary = getTextSummary(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(0); // No results as no files processed
    expect(summary).toContain('No files matched');

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should throw validation error for invalid input (empty operations)', async () => {
    const input = { paths: ['*.txt'], operations: [] };
    await expect(replaceContentTool.execute(input as any, defaultOptions))
        .rejects.toThrow('Input validation failed: operations: operations array cannot be empty.'); // Corrected Zod message
    expect(mockGlob).not.toHaveBeenCalled();
  });

  it('should throw glob error', async () => {
    const globError = new Error('Invalid glob pattern');
    mockGlob.mockRejectedValue(globError);
    // Added missing isRegex property
    const input = createInput(['[invalid'], [{ search: 'a', replace: 'b', isRegex: false }]);

    await expect(replaceContentTool.execute(input, defaultOptions))
        .rejects.toThrow(`Glob pattern error: ${globError.message}`);
  });

  it('should handle file read error', async () => {
    const filePath = 'file.txt';
    mockGlob.mockResolvedValue([filePath]);
    const readError = new Error('Permission denied');
    mockReadFile.mockRejectedValue(readError);
    // Added missing isRegex property
    const input = createInput([filePath], [{ search: 'a', replace: 'b', isRegex: false }]);

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false);
    expect(itemResult?.error).toContain('Permission denied');
    expect(itemResult?.suggestion).toEqual(expect.any(String));
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should handle file write error', async () => {
    const filePath = 'file.txt';
    const initialContent = 'hello';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    const writeError = new Error('Disk full');
    mockWriteFile.mockRejectedValue(writeError);
    // Added missing isRegex property
    const input = createInput([filePath], [{ search: 'hello', replace: 'hi', isRegex: false }], false);

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false);
    expect(itemResult?.error).toContain('Disk full');
    expect(itemResult?.suggestion).toEqual(expect.any(String));
    expect(mockWriteFile).toHaveBeenCalledTimes(1); // Write was attempted
  });

  it('should handle invalid regex error during operation', async () => {
    const filePath = 'file.txt';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue('content');
    const input = createInput([filePath], [{ search: '(', replace: 'fail', isRegex: true }]); // Invalid regex

    const parts = await replaceContentTool.execute(input, defaultOptions);
    const results = getJsonResult<FileReplaceResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false);
    expect(itemResult?.error).toContain('Invalid regex');
    expect(itemResult?.suggestion).toEqual(expect.any(String));
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should handle path validation failure for matched file', async () => {
    const filePath = '../outside.txt';
    mockGlob.mockResolvedValue([filePath]);
    // Added missing isRegex property
    const input = createInput([filePath], [{ search: 'a', replace: 'b', isRegex: false }]);

    const parts = await replaceContentTool.execute(input, defaultOptions); // allowOutsideWorkspace: false
    const results = getJsonResult<FileReplaceResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false);
    expect(itemResult?.error).toContain('Path validation failed');
    expect(itemResult?.suggestion).toEqual(expect.any(String));
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should succeed replacing outside workspace when allowed', async () => {
    const filePath = '../outside.txt';
    const initialContent = 'hello outside';
    const expectedContent = 'hi outside';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    // Added missing isRegex property
    const input = createInput([filePath], [{ search: 'hello', replace: 'hi', isRegex: false }], false);

    const parts = await replaceContentTool.execute(input, allowOutsideOptions);
    const results = getJsonResult<FileReplaceResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true);
    expect(itemResult?.error).toBeUndefined();
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), 'utf-8');
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, filePath),
      Buffer.from(expectedContent, 'utf-8'),
    );
  });
});