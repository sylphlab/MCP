import type { Dirent, Stats } from 'node:fs'; // Import types
import { readdir, stat } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import type { McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type
import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ListEntry, type ListFilesToolInput, listFilesTool } from './listFilesTool.js';

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  // Add other functions if needed
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

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
  path: '', // Add path property for compatibility
  parentPath: '', // Add parentPath property
});

// Helper to create mock Stats objects
const createMockStats = (isDirectory: boolean, isFile: boolean): Stats => ({
  isFile: () => isFile,
  isDirectory: () => isDirectory,
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
  dev: 0,
  ino: 0,
  mode: 0,
  nlink: 0,
  uid: 0,
  gid: 0,
  rdev: 0,
  size: 123, // Example size
  blksize: 4096,
  blocks: 1,
  atimeMs: Date.now(),
  mtimeMs: Date.now(),
  ctimeMs: Date.now(),
  birthtimeMs: Date.now(),
  atime: new Date(),
  mtime: new Date(),
  ctime: new Date(),
  birthtime: new Date(),
});

describe('listFilesTool', () => {
  // Use vi.mocked() which often handles overloads better
  const mockReaddir = vi.mocked(readdir);
  const mockStat = vi.mocked(stat);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockStat.mockResolvedValue(createMockStats(true, false)); // Assume path exists and is directory by default
    mockReaddir.mockResolvedValue([]); // Default to empty directory
  });
  // Define options objects including workspaceRoot
  const defaultOptions: McpToolExecuteOptions = {
    workspaceRoot: WORKSPACE_ROOT,
    allowOutsideWorkspace: false,
  };
  const allowOutsideOptions: McpToolExecuteOptions = {
    workspaceRoot: WORKSPACE_ROOT,
    allowOutsideWorkspace: true,
  };

  it('should list files non-recursively', async () => {
    const input: ListFilesToolInput = {
      paths: ['dir1'],
      recursive: false,
      includeStats: false,
      // allowOutsideWorkspace removed
    };
    const mockDirents = [
      createMockDirent('file1.txt', false, true),
      createMockDirent('subdir', true, false),
    ];
    mockReaddir.mockResolvedValue(mockDirents); // Cast needed as mock Dirent is simplified

    const result = await listFilesTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results.dir1?.success).toBe(true);
    expect(result.results.dir1?.entries).toHaveLength(2);
    expect(result.results.dir1?.entries?.[0]?.name).toBe('file1.txt');
    expect(result.results.dir1?.entries?.[0]?.isFile).toBe(true);
    expect(result.results.dir1?.entries?.[1]?.name).toBe('subdir');
    expect(result.results.dir1?.entries?.[1]?.isDirectory).toBe(true);
    expect(mockReaddir).toHaveBeenCalledTimes(1);
    expect(mockReaddir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'dir1'), {
      withFileTypes: true,
    });
    expect(mockStat).toHaveBeenCalledTimes(1); // Called once to check input path
  });

  it('should list files recursively', async () => {
    const input: ListFilesToolInput = {
      paths: ['dir1'],
      recursive: true,
      includeStats: false,
      // allowOutsideWorkspace removed
    };
    const topLevelDirents = [
      createMockDirent('file1.txt', false, true),
      createMockDirent('subdir', true, false),
    ];
    const subLevelDirents = [createMockDirent('file2.txt', false, true)];

    mockReaddir
      .mockResolvedValueOnce(topLevelDirents) // For dir1
      .mockResolvedValueOnce(subLevelDirents); // For dir1/subdir

    const result = await listFilesTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results.dir1?.success).toBe(true);
    expect(result.results.dir1?.entries).toHaveLength(3); // file1.txt, subdir, subdir/file2.txt
    expect(
      result.results.dir1?.entries?.some(
        (e: ListEntry) => e.path === path.join('dir1', 'file1.txt'),
      ),
    ).toBe(true);
    expect(
      result.results.dir1?.entries?.some((e: ListEntry) => e.path === path.join('dir1', 'subdir')),
    ).toBe(true);
    expect(
      result.results.dir1?.entries?.some(
        (e: ListEntry) => e.path === path.join('dir1', 'subdir', 'file2.txt'),
      ),
    ).toBe(true);
    expect(mockReaddir).toHaveBeenCalledTimes(2);
  });

  it('should list files recursively with maxDepth', async () => {
    const input: ListFilesToolInput = {
      paths: ['dir1'],
      recursive: true,
      maxDepth: 0,
      includeStats: false,
      // allowOutsideWorkspace removed
    };
    const topLevelDirents = [
      createMockDirent('file1.txt', false, true),
      createMockDirent('subdir', true, false),
    ];

    mockReaddir.mockResolvedValueOnce(topLevelDirents); // For dir1

    const result = await listFilesTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results.dir1?.success).toBe(true);
    expect(result.results.dir1?.entries).toHaveLength(2); // Only file1.txt, subdir
    expect(mockReaddir).toHaveBeenCalledTimes(1); // Only called once for dir1
  });

  it('should include stats when requested', async () => {
    const input: ListFilesToolInput = {
      paths: ['dir1'],
      includeStats: true,
      recursive: false,
      // allowOutsideWorkspace removed
    };
    const mockDirents = [createMockDirent('file1.txt', false, true)];
    const mockFileStats = createMockStats(false, true);
    mockReaddir.mockResolvedValue(mockDirents);
    // Mock stat call for the entry inside readdir loop
    mockStat
      .mockResolvedValueOnce(createMockStats(true, false)) // For input path check
      .mockResolvedValueOnce(mockFileStats); // For file1.txt

    const result = await listFilesTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results.dir1?.success).toBe(true);
    expect(result.results.dir1?.entries).toHaveLength(1);
    expect(result.results.dir1?.entries?.[0]?.stat).toBeDefined();
    expect(result.results.dir1?.entries?.[0]?.stat?.size).toBe(123); // Check example stat value
    expect(mockStat).toHaveBeenCalledTimes(2); // Input path + entry
  });

  it('should return validation error for empty paths array', async () => {
    const input = { paths: [] }; // Invalid input
    // @ts-expect-error - Intentionally passing invalid input for validation test
    const result = await listFilesTool.execute(input, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object
    expect(result.success).toBe(false);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('paths array cannot be empty');
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const input: ListFilesToolInput = {
      paths: ['../outside'],
      recursive: false,
      includeStats: false,
      // allowOutsideWorkspace removed
    };
    // Explicitly test with allowOutsideWorkspace: false
    const result = await listFilesTool.execute(input, defaultOptions); // Pass options object
    expect(result.success).toBe(false); // Overall success is false
    expect(result.results['../outside']?.success).toBe(false);
    expect(result.results['../outside']?.error).toContain('Path validation failed');
    expect(result.results['../outside']?.suggestion).toEqual(expect.any(String));
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('should handle non-existent path error', async () => {
    const input: ListFilesToolInput = {
      paths: ['nonexistent'],
      recursive: false,
      includeStats: false,
      // allowOutsideWorkspace removed
    };
    const statError = new Error('ENOENT');
    (statError as NodeJS.ErrnoException).code = 'ENOENT';
    mockStat.mockRejectedValue(statError); // Mock stat failure for input path

    const result = await listFilesTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results.nonexistent?.success).toBe(false);
    expect(result.results.nonexistent?.error).toContain('ENOENT');
    expect(result.results.nonexistent?.suggestion).toEqual(expect.any(String));
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('should handle path is not a directory error', async () => {
    const input: ListFilesToolInput = {
      paths: ['file.txt'],
      recursive: false,
      includeStats: false,
      // allowOutsideWorkspace removed
    };
    mockStat.mockResolvedValue(createMockStats(false, true)); // Mock stat says it's a file

    const result = await listFilesTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results['file.txt']?.success).toBe(false);
    expect(result.results['file.txt']?.error).toContain('is not a directory');
    expect(result.results['file.txt']?.suggestion).toEqual(expect.any(String));
    expect(mockReaddir).not.toHaveBeenCalled();
  });

  it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
    const input: ListFilesToolInput = {
      paths: ['../outside'],
      recursive: false,
      includeStats: false,
      // allowOutsideWorkspace removed
    };
    const mockDirents = [createMockDirent('file_out.txt', false, true)];
    mockReaddir.mockResolvedValue(mockDirents);
    // Mock stat for input path check to succeed
    mockStat.mockResolvedValue(createMockStats(true, false));

    // Act
    const result = await listFilesTool.execute(input, allowOutsideOptions); // Pass options object

    // Assert
    expect(result.success).toBe(true); // Should succeed as validation is skipped
    expect(result.results['../outside']?.success).toBe(true);
    expect(result.results['../outside']?.error).toBeUndefined();
    expect(mockStat).toHaveBeenCalledTimes(1); // Only input path stat check
    expect(mockReaddir).toHaveBeenCalledTimes(1);
    expect(mockReaddir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside'), {
      withFileTypes: true,
    }); // Check resolved path
  });

  // TODO: Add tests for readdir error during recursion
  // TODO: Add tests for stat error during includeStats loop
});
