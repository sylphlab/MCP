import type { Dirent, Stats } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part
import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ListEntry, type ListFilesToolInput, listFilesTool } from './listFilesTool.js';
import type { PathListResult } from './listFilesTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT };
const allowOutsideOptions: McpToolExecuteOptions = { ...defaultOptions, allowOutsideWorkspace: true };

// Helper to extract JSON result from parts (returns Record, not Array for this tool)
function getJsonResult(parts: Part[]): Record<string, PathListResult> | undefined {
  // console.log('DEBUG: getJsonResult received parts:', JSON.stringify(parts, null, 2)); // Keep commented for now
  const jsonPart = parts.find(part => part.type === 'json');
  // console.log('DEBUG: Found jsonPart:', JSON.stringify(jsonPart, null, 2)); // Keep commented for now
  // Check if jsonPart exists and has a 'value' property (which holds the actual data)
  if (jsonPart && jsonPart.value !== undefined) {
    // console.log('DEBUG: typeof jsonPart.value:', typeof jsonPart.value); // Keep commented for now
    // console.log('DEBUG: Attempting to use jsonPart.value directly'); // Keep commented for now
    try {
      // Assuming the value is already the correct Record type based on defineTool's outputSchema
      return jsonPart.value as Record<string, PathListResult>;
    } catch (_e) {
      return undefined;
    }
  }
  // console.log('DEBUG: jsonPart or jsonPart.value is undefined or null.'); // Keep commented for now
  return undefined;
}
// Helper to create mock Dirent objects
const createMockDirent = (name: string, isDirectory: boolean, isFile: boolean): Dirent => ({
  name,
  isFile: () => isFile,
  isDirectory: () => isDirectory,
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
  path: '', // Added for compatibility
  parentPath: '', // Added for compatibility
});

// Helper to create mock Stats objects
const createMockStats = (isDirectory: boolean, isFile: boolean): Stats => ({
  isFile: () => isFile,
  isDirectory: () => isDirectory,
  // Add other properties if needed, or cast to Partial<Stats>
} as Stats);


describe('listFilesTool', () => {
  const mockReaddir = vi.mocked(readdir);
  const mockStat = vi.mocked(stat);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockStat.mockResolvedValue(createMockStats(true, false)); // Assume path exists and is directory
    mockReaddir.mockResolvedValue([]); // Default to empty directory
  });

  it('should list files non-recursively', async () => {
    const input: ListFilesToolInput = { paths: ['dir1'], recursive: false, includeStats: false };
    const mockDirents = [
      createMockDirent('file1.txt', false, true),
      createMockDirent('subdir', true, false),
    ];
    mockReaddir.mockResolvedValue(mockDirents);

    const parts = await listFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    const dir1Result = results?.dir1;
    expect(dir1Result?.success).toBe(true);
    expect(dir1Result?.entries).toHaveLength(2);
    expect(dir1Result?.entries?.[0]?.name).toBe('file1.txt');
    expect(dir1Result?.entries?.[0]?.isFile).toBe(true);
    expect(dir1Result?.entries?.[1]?.name).toBe('subdir');
    expect(dir1Result?.entries?.[1]?.isDirectory).toBe(true);

    expect(mockReaddir).toHaveBeenCalledTimes(1);
    expect(mockReaddir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'dir1'), { withFileTypes: true });
    expect(mockStat).toHaveBeenCalledTimes(1); // Called once for input path check
  });

  it('should list files recursively', async () => {
    const input: ListFilesToolInput = { paths: ['dir1'], recursive: true, includeStats: false };
    const topLevelDirents = [
      createMockDirent('file1.txt', false, true),
      createMockDirent('subdir', true, false),
    ];
    const subLevelDirents = [createMockDirent('file2.txt', false, true)];

    mockReaddir
      .mockResolvedValueOnce(topLevelDirents) // For dir1
      .mockResolvedValueOnce(subLevelDirents); // For dir1/subdir

    const parts = await listFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    const dir1Result = results?.dir1;
    expect(dir1Result?.success).toBe(true);
    expect(dir1Result?.entries).toHaveLength(3); // file1.txt, subdir, subdir/file2.txt
    expect(dir1Result?.entries?.some((e: ListEntry) => e.path === path.join('dir1', 'file1.txt'))).toBe(true);
    expect(dir1Result?.entries?.some((e: ListEntry) => e.path === path.join('dir1', 'subdir'))).toBe(true);
    expect(dir1Result?.entries?.some((e: ListEntry) => e.path === path.join('dir1', 'subdir', 'file2.txt'))).toBe(true);

    expect(mockReaddir).toHaveBeenCalledTimes(2);
  });

  it('should list files recursively with maxDepth', async () => {
    const input: ListFilesToolInput = { paths: ['dir1'], recursive: true, maxDepth: 0 };
    const topLevelDirents = [
      createMockDirent('file1.txt', false, true),
      createMockDirent('subdir', true, false),
    ];
    mockReaddir.mockResolvedValueOnce(topLevelDirents);

    const parts = await listFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    const dir1Result = results?.dir1;
    expect(dir1Result?.success).toBe(true);
    expect(dir1Result?.entries).toHaveLength(2); // Only top level
    expect(mockReaddir).toHaveBeenCalledTimes(1); // Only called once
  });

  it('should include stats when requested', async () => {
    const input: ListFilesToolInput = { paths: ['dir1'], includeStats: true };
      .mockResolvedValueOnce(createMockStats(true, false)) // For input path check
      .mockResolvedValueOnce(mockFileStats); // For file1.txt

    const _parts = await listFilesTool.execute(input, defaultOptions);
        .rejects.toThrow('Input validation failed: paths: Array must contain at least 1 element(s)');

    expect(results).toBeDefined();
    const dir1Result = results?.dir1;
    expect(dir1Result?.success).toBe(true);
    expect(dir1Result?.entries).toHaveLength(1);
    expect(dir1Result?.entries?.[0]?.stat).toBeDefined();
    expect(dir1Result?.entries?.[0]?.stat?.size).toBe(456);
    expect(mockStat).toHaveBeenCalledTimes(2); // Input path + entry
  });

  it('should throw validation error for empty paths array', async () => {
    const input = { paths: [] };
    await expect(listFilesTool.execute(input as any, defaultOptions))
        .rejects.toThrow('Input validation failed: paths: Array must contain at least 1 element(s)');
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const input: ListFilesToolInput = { paths: ['../outside'] };
    const parts = await listFilesTool.execute(input, defaultOptions); // allowOutsideWorkspace defaults to false
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    const outsideResult = results?.['../outside'];
    expect(outsideResult?.success).toBe(false);
    expect(outsideResult?.error).toContain('Path validation failed');
    expect(outsideResult?.suggestion).toEqual(expect.any(String));
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('should handle non-existent path error', async () => {
    const input: ListFilesToolInput = { paths: ['nonexistent'] };
    const statError = new Error('ENOENT');
    (statError as NodeJS.ErrnoException).code = 'ENOENT';
    mockStat.mockRejectedValue(statError); // Mock stat failure for input path

    const parts = await listFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    const nonexistentResult = results?.nonexistent;
    expect(nonexistentResult?.success).toBe(false);
    expect(nonexistentResult?.error).toContain('ENOENT');
    expect(nonexistentResult?.suggestion).toEqual(expect.any(String));
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('should handle path is not a directory error', async () => {
    const input: ListFilesToolInput = { paths: ['file.txt'] };
    mockStat.mockResolvedValue(createMockStats(false, true)); // Mock stat says it's a file

    const parts = await listFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    const fileTxtResult = results?.['file.txt'];
    expect(fileTxtResult?.success).toBe(false);
    expect(fileTxtResult?.error).toContain('is not a directory');
    expect(fileTxtResult?.suggestion).toEqual(expect.any(String));
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('should succeed listing outside workspace when allowed', async () => {
    const input: ListFilesToolInput = { paths: ['../outside'] };
    const mockDirents = [createMockDirent('file_out.txt', false, true)];
    mockReaddir.mockResolvedValue(mockDirents);
    mockStat.mockResolvedValue(createMockStats(true, false)); // Mock stat for input path check

    const parts = await listFilesTool.execute(input, allowOutsideOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    const outsideResult = results?.['../outside'];
    expect(outsideResult?.success).toBe(true);
    expect(outsideResult?.error).toBeUndefined();
    expect(mockStat).toHaveBeenCalledTimes(1); // Only input path stat check
    expect(mockReaddir).toHaveBeenCalledTimes(1);
    expect(mockReaddir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside'), { withFileTypes: true });
  });
});