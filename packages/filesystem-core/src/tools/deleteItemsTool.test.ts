import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { rm } from 'node:fs/promises'; // Use named import
import path from 'node:path';
import trash from 'trash'; // Import trash
import { deleteItemsTool, DeleteItemsToolInput } from './deleteItemsTool';

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  rm: vi.fn(),
  // Add other functions if needed
}));

// Mock the trash module
vi.mock('trash', () => ({
  // trash is usually a default export function
  default: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

describe('deleteItemsTool', () => {
  const mockRm = rm as MockedFunction<typeof rm>;
  const mockTrash = trash as MockedFunction<typeof trash>;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully delete a single item using trash (default)', async () => {
    // Arrange
    const input: DeleteItemsToolInput = {
      paths: ['file_to_trash.txt'],
      useTrash: true,
      recursive: true,
      // allowOutsideWorkspace removed
    };
    mockTrash.mockResolvedValue(undefined); // Mock successful trash operation

    // Act
    const result = await deleteItemsTool.execute(input, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    // Assert
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(true);
    expect(result.results[0]!.path).toBe('file_to_trash.txt');
    expect(result.results[0]!.message).toContain('deleted (trash)');
    expect(result.results[0]!.error).toBeUndefined();
    expect(mockTrash).toHaveBeenCalledTimes(1);
    expect(mockTrash).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file_to_trash.txt'));
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should successfully delete multiple items permanently', async () => {
    // Arrange
    const input: DeleteItemsToolInput = {
      paths: ['file1.txt', 'folder_to_delete'],
      useTrash: false,
      recursive: true,
      // allowOutsideWorkspace removed
    };
    mockRm.mockResolvedValue(undefined); // Mock successful rm operation

    // Act
    const result = await deleteItemsTool.execute(input, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    // Assert
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.success).toBe(true);
    expect(result.results[0]!.message).toContain('deleted (delete permanently)');
    expect(result.results[1]!.success).toBe(true);
    expect(result.results[1]!.message).toContain('deleted (delete permanently)');
    expect(mockRm).toHaveBeenCalledTimes(2);
    expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file1.txt'), { recursive: true, force: true });
    expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'folder_to_delete'), { recursive: true, force: true });
    expect(mockTrash).not.toHaveBeenCalled();
  });

   it('should return validation error for empty paths array', async () => {
    // Arrange
    const input = { paths: [] }; // Invalid input

    // Act
    const result = await deleteItemsTool.execute(input as any, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('paths array cannot be empty');
    expect(result.results).toHaveLength(0);
    expect(mockTrash).not.toHaveBeenCalled();
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    // Arrange
    const input: DeleteItemsToolInput = {
      paths: ['../outside.txt'],
      useTrash: true,
      recursive: true,
      // allowOutsideWorkspace removed
    };

    // Act
    const result = await deleteItemsTool.execute(input, { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false }); // Pass options object

    // Assert
    expect(result.success).toBe(false); // Overall success is false
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(false);
    expect(result.results[0]!.error).toContain('Path validation failed');
    expect(result.results[0]!.suggestion).toEqual(expect.any(String));
    expect(mockTrash).not.toHaveBeenCalled();
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle trash errors', async () => {
    // Arrange
    const input: DeleteItemsToolInput = {
      paths: ['error_file.txt'],
      useTrash: true,
      recursive: true,
      // allowOutsideWorkspace removed
    };
    const testError = new Error('Trash failed');
    mockTrash.mockRejectedValue(testError);

    // Act
    const result = await deleteItemsTool.execute(input, { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false }); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(false);
    expect(result.results[0]!.error).toContain('Failed to trash');
    expect(result.results[0]!.error).toContain('Trash failed');
    expect(result.results[0]!.suggestion).toEqual(expect.any(String));
    expect(mockTrash).toHaveBeenCalledTimes(1);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle rm errors', async () => {
    // Arrange
    const input: DeleteItemsToolInput = {
      paths: ['error_file.txt'],
      useTrash: false,
      recursive: true,
      // allowOutsideWorkspace removed
    };
    const testError = new Error('rm failed');
    mockRm.mockRejectedValue(testError);

    // Act
    const result = await deleteItemsTool.execute(input, { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false }); // Pass options object

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(false);
    expect(result.results[0]!.error).toContain('Failed to delete permanently');
    expect(result.results[0]!.error).toContain('rm failed');
    expect(result.results[0]!.suggestion).toEqual(expect.any(String));
    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(mockTrash).not.toHaveBeenCalled();
  });

  it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
    const input: DeleteItemsToolInput = {
      paths: ['../outside.txt'],
      useTrash: true, // Use trash for simplicity
      recursive: true,
      // allowOutsideWorkspace removed
    };
    mockTrash.mockResolvedValue(undefined); // Mock success

    // Act
    const result = await deleteItemsTool.execute(input, { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: true }); // Pass options object

    // Assert
    expect(result.success).toBe(true); // Should succeed as validation is skipped
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.error).toBeUndefined();
    expect(mockTrash).toHaveBeenCalledTimes(1);
    expect(mockTrash).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt')); // Check resolved path
    expect(mockRm).not.toHaveBeenCalled();
  });


  // TODO: Add tests for glob support once implemented
  // TODO: Add tests for recursive false when using rm
});