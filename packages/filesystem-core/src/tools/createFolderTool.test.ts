import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { mkdir } from 'node:fs/promises'; // Use named import
import path from 'node:path';
import { createFolderTool, type CreateFolderToolInput } from './createFolderTool';

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  // Add other functions if needed by the code under test
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

describe('createFolderTool', () => {
  const mockMkdir = mkdir as MockedFunction<typeof mkdir>;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully create a single folder', async () => {
    // Arrange
    const input: CreateFolderToolInput = {
      folderPaths: ['new/folder'],
      // allowOutsideWorkspace removed
    };
    mockMkdir.mockResolvedValue(undefined); // Mock successful creation

    // Act
    const result = await createFolderTool.execute(input, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    // Assert
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(true);
    expect(result.results[0]!.path).toBe('new/folder');
    expect(result.results[0]!.error).toBeUndefined();
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'new/folder'),
      { recursive: true }
    );
  });

  it('should successfully create multiple folders', async () => {
    // Arrange
    const input: CreateFolderToolInput = {
      folderPaths: ['folder1', 'folder2/sub'],
      // allowOutsideWorkspace removed
    };
    mockMkdir.mockResolvedValue(undefined);

    // Act
    const result = await createFolderTool.execute(input, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    // Assert
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.success).toBe(true);
    expect(result.results[1]!.success).toBe(true);
    expect(mockMkdir).toHaveBeenCalledTimes(2);
    expect(mockMkdir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'folder1'), { recursive: true });
    expect(mockMkdir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'folder2/sub'), { recursive: true });
  });

  it('should return validation error for empty folderPaths array', async () => {
    // Arrange
    const input = { folderPaths: [] }; // Invalid input

    // Act
    const result = await createFolderTool.execute(input as any, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    // Assert
    expect(result.success).toBe(false); // Overall success is false
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('folderPaths array cannot be empty');
    expect(result.results).toHaveLength(0);
    expect(mockMkdir).not.toHaveBeenCalled();
  });

   it('should handle path validation failure (outside workspace)', async () => {
    // Arrange
    const input: CreateFolderToolInput = {
      folderPaths: ['../outside'],
      // allowOutsideWorkspace removed
    };

    // Act
    const result = await createFolderTool.execute(input, { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false }); // Pass options object

    // Assert
    expect(result.success).toBe(false); // Overall success is false
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(false);
    expect(result.results[0]!.error).toContain('Path validation failed');
    expect(result.results[0]!.suggestion).toEqual(expect.any(String));
    expect(mockMkdir).not.toHaveBeenCalled();
  });

  it('should handle mkdir errors', async () => {
    // Arrange
    const input: CreateFolderToolInput = {
      folderPaths: ['valid/path', 'error/path'],
      // allowOutsideWorkspace removed
    };
    const testError = new Error('Permission denied');
    // Mock first call success, second call failure
    mockMkdir
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(testError);

    // Act
    const result = await createFolderTool.execute(input, { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false }); // Pass options object

    // Assert
    expect(result.success).toBe(true); // Overall success is true because one succeeded
    expect(result.results).toHaveLength(2);
    // First item
    expect(result.results[0]!.success).toBe(true);
    expect(result.results[0]!.error).toBeUndefined();
    // Second item
    expect(result.results[1]!.success).toBe(false);
    expect(result.results[1]!.error).toContain('Permission denied');
    expect(result.results[1]!.suggestion).toEqual(expect.any(String));
    expect(mockMkdir).toHaveBeenCalledTimes(2);
  });

  it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
    const input: CreateFolderToolInput = {
      folderPaths: ['../outside/new'],
      // allowOutsideWorkspace removed from input
    };
    mockMkdir.mockResolvedValue(undefined); // Mock success

    // Act
    const result = await createFolderTool.execute(input, { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: true }); // Pass options object

    // Assert
    expect(result.success).toBe(true); // Should succeed as validation is skipped
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.error).toBeUndefined();
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, '../outside/new'), // Check resolved path
      { recursive: true }
    );
  });


  // TODO: Add tests for invalid path characters if applicable on target OS
});