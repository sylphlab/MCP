import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import glob from 'fast-glob'; // Import fast-glob
import { replaceContentTool, ReplaceContentToolInput, ReplaceOperation } from './replaceContentTool';
import { McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type


// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock fast-glob
vi.mock('fast-glob', () => ({
  default: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

describe('replaceContentTool', () => {
  const mockReadFile = vi.mocked(readFile);
  const mockWriteFile = vi.mocked(writeFile);
  const mockGlob = vi.mocked(glob); // Use vi.mocked

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockGlob.mockResolvedValue([]); // Default to no files matched
    mockReadFile.mockResolvedValue(''); // Default to empty file
    mockWriteFile.mockResolvedValue(undefined); // Default to successful write
  });

  // Define options objects including workspaceRoot
  const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false };
  const allowOutsideOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: true };

  // Helper
  const createInput = (paths: string[], operations: ReplaceOperation[]): Omit<ReplaceContentToolInput, 'allowOutsideWorkspace'> => ({ paths, operations });

  it('should perform simple text replacement in one file', async () => {
    const filePath = 'file.txt';
    const initialContent = 'hello world, hello';
    const expectedContent = 'hi world, hi';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([filePath], [{ search: 'hello', replace: 'hi', isRegex: false }]); // Add isRegex

    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.path).toBe(filePath);
    expect(result.results[0]?.replacementsMade).toBe(2);
    expect(result.results[0]?.contentChanged).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8');
  });

  it('should perform regex replacement in one file', async () => {
    const filePath = 'file.txt';
    const initialContent = 'line 1\nline 2';
    const expectedContent = 'L1\nL2';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([filePath], [{ search: 'line (\\d)', replace: 'L$1', isRegex: true, flags: 'g' }]);

    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.replacementsMade).toBeGreaterThan(0); // Simplistic check for regex
    expect(result.results[0]?.contentChanged).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8');
  });

  it('should perform replacements across multiple files from glob', async () => {
    const files = ['file1.txt', 'sub/file2.txt'];
    mockGlob.mockResolvedValue(files);
    mockReadFile
      .mockResolvedValueOnce('content A')
      .mockResolvedValueOnce('content B');
    const input = createInput(['**/*.txt'], [{ search: 'content', replace: 'CONTENT', isRegex: false }]); // Add isRegex
    const expectedContent1 = 'CONTENT A';
    const expectedContent2 = 'CONTENT B';

    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[1]?.success).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, files[0]!), expectedContent1, 'utf-8'); // Add !
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, files[1]!), expectedContent2, 'utf-8'); // Add !
  });

  it('should not write file if no replacements are made', async () => {
    const filePath = 'file.txt';
    const initialContent = 'no matches here';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([filePath], [{ search: 'missing', replace: 'found', isRegex: false }]); // Add isRegex

    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.replacementsMade).toBe(0);
    expect(result.results[0]?.contentChanged).toBe(false);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

   it('should return success if no files match glob', async () => {
    mockGlob.mockResolvedValue([]); // No files matched
    const input = createInput(['*.nomatch'], [{ search: 'a', replace: 'b', isRegex: false }]);

    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should return validation error for invalid input', async () => {
    const input = { paths: ['*.txt'], operations: [] }; // Empty operations array
    const result = await replaceContentTool.execute(input as any, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    expect(result.success).toBe(false);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('operations array cannot be empty');
    expect(mockGlob).not.toHaveBeenCalled();
  });

  it('should handle glob error', async () => {
    const globError = new Error('Invalid glob pattern');
    mockGlob.mockRejectedValue(globError);
    const input = createInput(['[invalid'], [{ search: 'a', replace: 'b', isRegex: false }]);

    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.error).toContain('Glob pattern error');
    expect(result.error).toContain('Invalid glob pattern');
    // Suggestions aren't added at this top level error, only per-file
  });

  it('should handle file read error', async () => {
    const filePath = 'file.txt';
    mockGlob.mockResolvedValue([filePath]);
    const readError = new Error('Permission denied');
    mockReadFile.mockRejectedValue(readError);
    const input = createInput([filePath], [{ search: 'a', replace: 'b', isRegex: false }]);

    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false); // Overall fails if one file fails
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Permission denied');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should handle file write error', async () => {
    const filePath = 'file.txt';
    const initialContent = 'hello';
    mockGlob.mockResolvedValue([filePath]);
    mockReadFile.mockResolvedValue(initialContent);
    const writeError = new Error('Disk full');
    mockWriteFile.mockRejectedValue(writeError);
    const input = createInput([filePath], [{ search: 'hello', replace: 'hi', isRegex: false }]);

    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Disk full');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockWriteFile).toHaveBeenCalledTimes(1); // Write was attempted
  });

  it('should handle invalid regex error during operation', async () => {
     const filePath = 'file.txt';
     mockGlob.mockResolvedValue([filePath]);
     mockReadFile.mockResolvedValue('content');
     const input = createInput([filePath], [{ search: '(', replace: 'fail', isRegex: true }]); // Invalid regex
 
     const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object
 
     expect(result.success).toBe(false);
     expect(result.results[0]?.success).toBe(false);
     expect(result.results[0]?.error).toContain('Invalid regex');
     expect(result.results[0]?.suggestion).toEqual(expect.any(String));
     expect(mockWriteFile).not.toHaveBeenCalled();
   });

  it('should handle path validation failure for matched file (belt-and-suspenders)', async () => {
    // This tests the internal check, even though glob should prevent this
    const filePath = '../outside.txt'; // Path outside workspace
    mockGlob.mockResolvedValue([filePath]); // Simulate glob returning an outside path
    const input = createInput([filePath], [{ search: 'a', replace: 'b', isRegex: false }]); // Add isRegex

    // Act
    const result = await replaceContentTool.execute(input, defaultOptions); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Path validation failed');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
    const filePath = '../outside.txt';
    const initialContent = 'hello outside';
    const expectedContent = 'hi outside';
    mockGlob.mockResolvedValue([filePath]); // Simulate glob returning outside path
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([filePath], [{ search: 'hello', replace: 'hi', isRegex: false }]); // Add isRegex

    // Act
    const result = await replaceContentTool.execute(input, allowOutsideOptions); // Pass options object

    // Assert
    expect(result.success).toBe(true); // Should succeed as validation is skipped
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.error).toBeUndefined();
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), 'utf-8');
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8');
  });


  // TODO: Add tests for lineRange once implemented
  // TODO: Add tests for multiple operations on one file
  // TODO: Add tests for more complex regex replacement counting
});