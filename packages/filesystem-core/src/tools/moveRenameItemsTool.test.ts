import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { rename, mkdir, rm, stat } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import { Stats } from 'node:fs'; // Import Stats type
import { moveRenameItemsTool, MoveRenameItemsToolInput } from './moveRenameItemsTool';
import { McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type


// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  rename: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

// Helper to create mock Stats objects
const createMockStats = (isDirectory: boolean, isFile: boolean): Stats => ({
    isFile: () => isFile,
    isDirectory: () => isDirectory,
    // Add other properties if needed, or cast to Partial<Stats>
    dev: 0, ino: 0, mode: 0, nlink: 0, uid: 0, gid: 0, rdev: 0, size: 123, blksize: 4096, blocks: 1, atimeMs: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0, atime: new Date(), mtime: new Date(), ctime: new Date(), birthtime: new Date(),
} as Stats);


describe('moveRenameItemsTool', () => {
  const mockRename = vi.mocked(rename);
  const mockMkdir = vi.mocked(mkdir);
  const mockRm = vi.mocked(rm);
  const mockStat = vi.mocked(stat);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockRename.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined); // Assume mkdir succeeds
    mockRm.mockResolvedValue(undefined);
    // Default stat to ENOENT (file not found)
    const enoentError = new Error('ENOENT');
    (enoentError as any).code = 'ENOENT';
    mockStat.mockRejectedValue(enoentError);
  });
  // Define options objects including workspaceRoot
  const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false };
  const allowOutsideOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: true };


  it('should successfully move/rename item when destination does not exist', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'new.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    // stat will reject with ENOENT (default mock)

    const result = await moveRenameItemsTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(mockMkdir).toHaveBeenCalledTimes(1); // Ensure parent dir creation called
    expect(mockStat).toHaveBeenCalledTimes(1); // Check destination existence
    expect(mockRm).not.toHaveBeenCalled(); // Should not remove if not exists
    expect(mockRename).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'old.txt'),
      path.resolve(WORKSPACE_ROOT, 'new.txt')
    );
  });

  it('should successfully move/rename with overwrite: true when destination exists', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
      overwrite: true,
      // allowOutsideWorkspace removed
    };
    // Mock stat to indicate destination exists
    mockStat.mockResolvedValue(createMockStats(false, true));

    const result = await moveRenameItemsTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockStat).toHaveBeenCalledTimes(1); // Check destination existence
    expect(mockRm).toHaveBeenCalledTimes(1); // Should remove existing destination
    expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'existing.txt'), { recursive: true, force: true });
    expect(mockRename).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'old.txt'),
      path.resolve(WORKSPACE_ROOT, 'existing.txt')
    );
  });

  it('should fail move/rename when destination exists and overwrite: false', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    // Mock stat to indicate destination exists
    mockStat.mockResolvedValue(createMockStats(false, true));

    const result = await moveRenameItemsTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('already exists and overwrite is false');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockStat).toHaveBeenCalledTimes(1); // Check destination existence
    expect(mockRm).not.toHaveBeenCalled(); // Should NOT remove
    expect(mockRename).not.toHaveBeenCalled(); // Should NOT rename
  });

  it('should return validation error for empty items array', async () => {
    const input = { items: [] }; // Invalid input
    const result = await moveRenameItemsTool.execute(input as any, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object
    expect(result.success).toBe(false);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('items array cannot be empty');
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'valid.txt', destinationPath: '../outside.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    // Explicitly test with allowOutsideWorkspace: false
    const result = await moveRenameItemsTool.execute(input, defaultOptions); // Pass options object
    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Path validation failed');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('should handle source does not exist error (from rename)', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'nonexistent.txt', destinationPath: 'new.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    const renameError = new Error('ENOENT');
    (renameError as any).code = 'ENOENT';
    mockRename.mockRejectedValue(renameError);
    // stat will reject with ENOENT (default mock) for destination

    const result = await moveRenameItemsTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('ENOENT');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockRename).toHaveBeenCalledTimes(1);
  });

  it('should handle mkdir error', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'new_dir/new.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    const mkdirError = new Error('EACCES');
    mockMkdir.mockRejectedValue(mkdirError);
    // stat will reject with ENOENT (default mock) for destination

    const result = await moveRenameItemsTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('EACCES');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockRename).not.toHaveBeenCalled();
  });

   it('should handle rm error during overwrite', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
      overwrite: true,
      // allowOutsideWorkspace removed
    };
    mockStat.mockResolvedValue(createMockStats(false, true)); // Destination exists
    const rmError = new Error('EPERM');
    mockRm.mockRejectedValue(rmError); // Mock rm failure

    const result = await moveRenameItemsTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('EPERM');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'valid.txt', destinationPath: '../outside.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    // stat will reject with ENOENT (default mock) for destination
    mockRename.mockResolvedValue(undefined); // Mock success

    // Act
    const result = await moveRenameItemsTool.execute(input, allowOutsideOptions); // Pass options object

    // Assert
    expect(result.success).toBe(true); // Should succeed as validation is skipped
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.error).toBeUndefined();
    expect(mockMkdir).toHaveBeenCalledTimes(1); // Dest dir check
    expect(mockStat).toHaveBeenCalledTimes(1); // Dest existence check
    expect(mockRm).not.toHaveBeenCalled();
    expect(mockRename).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'valid.txt'),
      path.resolve(WORKSPACE_ROOT, '../outside.txt') // Check resolved path
    );
  });


  // TODO: Add tests for multiple items (success/fail mix)
  // TODO: Add tests for moving directories vs files
});