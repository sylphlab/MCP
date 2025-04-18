import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { mkdir } from 'node:fs/promises'; // Use named import
import path from 'node:path';
import { createFolderTool, CreateFolderToolInput } from './createFolderTool';

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
    };
    mockMkdir.mockResolvedValue(undefined); // Mock successful creation

    // Act
    const result = await createFolderTool.execute(input, WORKSPACE_ROOT);

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
    };
    mockMkdir.mockResolvedValue(undefined);

    // Act
    const result = await createFolderTool.execute(input, WORKSPACE_ROOT);

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
    const result = await createFolderTool.execute(input as any, WORKSPACE_ROOT);

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
    };

    // Act
    const result = await createFolderTool.execute(input, WORKSPACE_ROOT);

    // Assert
    expect(result.success).toBe(false); // Overall success is false
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(false);
    expect(result.results[0]!.error).toContain('Path validation failed');
    expect(mockMkdir).not.toHaveBeenCalled();
  });

  it('should handle mkdir errors', async () => {
    // Arrange
    const input: CreateFolderToolInput = {
      folderPaths: ['valid/path', 'error/path'],
    };
    const testError = new Error('Permission denied');
    // Mock first call success, second call failure
    mockMkdir
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(testError);

    // Act
    const result = await createFolderTool.execute(input, WORKSPACE_ROOT);

    // Assert
    expect(result.success).toBe(true); // Overall success is true because one succeeded
    expect(result.results).toHaveLength(2);
    // First item
    expect(result.results[0]!.success).toBe(true);
    expect(result.results[0]!.error).toBeUndefined();
    // Second item
    expect(result.results[1]!.success).toBe(false);
    expect(result.results[1]!.error).toContain('Permission denied');
    expect(mockMkdir).toHaveBeenCalledTimes(2);
  });

  // TODO: Add tests for invalid path characters if applicable on target OS
});