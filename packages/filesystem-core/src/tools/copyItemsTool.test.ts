import type { Stats } from 'node:fs'; // Import Stats type
import { cp, mkdir, stat } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import { type MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CopyItemsToolInput, copyItemsTool } from './copyItemsTool.js';

// Mock the specific fs/promises functions we need (using named exports)
vi.mock('node:fs/promises', () => ({
  cp: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

// Helper to create mock Stats objects
const _createMockStats = (isFile: boolean): Stats =>
  ({
    isFile: () => isFile,
    isDirectory: () => !isFile,
    // Add other properties if needed, or cast to Partial<Stats>
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size: 123,
    blksize: 4096,
    blocks: 1,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: new Date(),
    mtime: new Date(),
    ctime: new Date(),
    birthtime: new Date(),
  }) as Stats;

describe('copyItemsTool', () => {
  // Cast the imported named function to access mock methods
  const mockCp = cp as MockedFunction<typeof cp>;
  const mockStat = stat as MockedFunction<typeof stat>;
  // const mockMkdir = mkdir as MockedFunction<typeof mkdir>; // If needed

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    // Default stat to ENOENT (file not found)
    const enoentError = new Error('ENOENT');
    (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
    mockStat.mockRejectedValue(enoentError);
    mockCp.mockResolvedValue(undefined); // Default cp to success
  });

  it('should successfully copy a single file when destination does not exist', async () => {
    // Arrange
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'dest/target.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    // stat will reject with ENOENT (default mock)

    // Act
    const result = await copyItemsTool.execute(input, {
      workspaceRoot: WORKSPACE_ROOT,
      allowOutsideWorkspace: false,
    }); // Pass options object

    // Assert
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.sourcePath).toBe('source.txt');
    expect(result.results[0]?.destinationPath).toBe('dest/target.txt');
    expect(result.results[0]?.error).toBeUndefined();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'source.txt'),
      path.resolve(WORKSPACE_ROOT, 'dest/target.txt'),
      { recursive: true, force: false, errorOnExist: true }, // Check options
    );
  });

  it('should fail if input items array is empty', async () => {
    // Arrange
    const input = { items: [] };

    // Act
    // @ts-expect-error - Intentionally passing invalid input for validation test
    const result = await copyItemsTool.execute(input, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('At least one copy item is required.'); // Match schema message
    expect(result.results).toHaveLength(0);
    expect(mockCp).not.toHaveBeenCalled();
  });

  it('should fail if an item has missing sourcePath', async () => {
    // Arrange
    const input = {
      items: [{ destinationPath: 'dest.txt' }],
      overwrite: false,
      allowOutsideWorkspace: false,
    };

    // Act
    // @ts-expect-error - Intentionally passing invalid input for validation test
    const result = await copyItemsTool.execute(input, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input validation failed');
    // Zod reports error on the array item level if a required field within an object is missing
    expect(result.error).toContain('items: Required');
    expect(mockCp).not.toHaveBeenCalled();
  });

  // TODO: Add tests for:
  // - Overwrite true/false scenarios (when destination exists) -> Covered below
  // - Multiple items (some succeed, some fail)
  // - Recursive directory copy

  it('should handle ENOENT error when source does not exist', async () => {
    // Arrange
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'nonexistent.txt', destinationPath: 'dest.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    const enoentError = new Error('Source does not exist');
    (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
    mockCp.mockRejectedValue(enoentError); // Mock cp failure

    // Act
    const result = await copyItemsTool.execute(input, {
      workspaceRoot: WORKSPACE_ROOT,
      allowOutsideWorkspace: false,
    }); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Source path does not exist');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockCp).toHaveBeenCalledTimes(1);
  });

  it('should handle EEXIST error when destination exists and overwrite is false', async () => {
    // Arrange
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'existing.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    const eexistError = new Error('Destination exists');
    (eexistError as NodeJS.ErrnoException).code = 'EEXIST';
    mockCp.mockRejectedValue(eexistError); // Mock cp failure

    // Act
    const result = await copyItemsTool.execute(input, {
      workspaceRoot: WORKSPACE_ROOT,
      allowOutsideWorkspace: false,
    }); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain(
      'Destination path already exists and overwrite is false',
    );
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'source.txt'),
      path.resolve(WORKSPACE_ROOT, 'existing.txt'),
      { recursive: true, force: false, errorOnExist: true },
    );
  });

  it('should handle generic errors during copy', async () => {
    // Arrange
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'dest.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed
    };
    const genericError = new Error('Something went wrong');
    mockCp.mockRejectedValue(genericError);

    // Act
    const result = await copyItemsTool.execute(input, {
      workspaceRoot: WORKSPACE_ROOT,
      allowOutsideWorkspace: false,
    }); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Something went wrong');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockCp).toHaveBeenCalledTimes(1);
  });

  it('should fail path validation if path is outside workspace and allowOutsideWorkspace is false (default)', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: '../outside.txt', destinationPath: 'dest.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed from input
    };

    const result = await copyItemsTool.execute(input, {
      workspaceRoot: WORKSPACE_ROOT,
      allowOutsideWorkspace: false,
    }); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Path validation failed');
    expect(result.results[0]?.suggestion).toEqual(expect.any(String));
    expect(mockCp).not.toHaveBeenCalled();
  });

  it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: '../outside.txt', destinationPath: 'dest.txt' }],
      overwrite: false,
      // allowOutsideWorkspace removed from input
    };
    // Mock cp to succeed even though path is outside for this test
    mockCp.mockResolvedValue(undefined);

    const result = await copyItemsTool.execute(input, {
      workspaceRoot: WORKSPACE_ROOT,
      allowOutsideWorkspace: true,
    }); // Pass options object

    // Expect success because validation is skipped
    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.error).toBeUndefined();
    expect(mockCp).toHaveBeenCalledTimes(1);
    // Check that resolved paths (potentially outside root) were used
    expect(mockCp).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, '../outside.txt'),
      path.resolve(WORKSPACE_ROOT, 'dest.txt'),
      expect.anything(),
    );
  });

  // TODO: Add tests for:
  // - Multiple items (success/fail mix)
  // - Recursive directory copy
  // - Other potential fs errors
});
