import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { cp, stat, mkdir } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import { copyItemsTool, CopyItemsToolInput } from './copyItemsTool';

// Mock the specific fs/promises functions we need (using named exports)
vi.mock('node:fs/promises', () => ({
  cp: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock path.resolve to control path resolution if necessary, though often not needed if workspaceRoot is consistent
// vi.mock('node:path');

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

describe('copyItemsTool', () => {
  // Cast the imported named function to access mock methods
  const mockCp = cp as MockedFunction<typeof cp>;
  // const mockStat = stat as MockedFunction<typeof stat>; // If needed
  // const mockMkdir = mkdir as MockedFunction<typeof mkdir>; // If needed

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });

  it('should successfully copy a single file when destination does not exist', async () => {
    // Arrange
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'dest/target.txt' }],
      overwrite: false,
    };
    // Mock fsPromises.cp to resolve successfully for this case
    mockCp.mockResolvedValue(undefined);

    // Act
    const result = await copyItemsTool.execute(input, WORKSPACE_ROOT);

    // Assert
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(true);
    expect(result.results[0]!.sourcePath).toBe('source.txt');
    expect(result.results[0]!.destinationPath).toBe('dest/target.txt');
    expect(result.results[0]!.error).toBeUndefined();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'source.txt'),
      path.resolve(WORKSPACE_ROOT, 'dest/target.txt'),
      { recursive: true, force: false, errorOnExist: true } // Check options
    );
  });

  it('should fail if input items array is empty', async () => {
    // Arrange
    // Note: Zod schema handles empty array check before accessing overwrite
    const input = {
      items: [], // Empty array
    };

    // Act
    // Cast to any to bypass static type check for testing runtime validation
    const result = await copyItemsTool.execute(input as any, WORKSPACE_ROOT);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('items array cannot be empty'); // Match Zod error
    expect(result.results).toHaveLength(0);
    expect(mockCp).not.toHaveBeenCalled();
  });

  it('should fail if an item has missing sourcePath', async () => {
    // Arrange
    const input = { // Intentionally malformed input, Zod will catch this
        items: [{ destinationPath: 'dest.txt' } as any],
        overwrite: false, // Add overwrite
    };

    // Act
    // Cast to McpToolInput as the raw input might not match the Zod-inferred type perfectly before parsing
    const result = await copyItemsTool.execute(input as any, WORKSPACE_ROOT);

    // Assert
    expect(result.success).toBe(false); // Overall should fail
    // Zod error message format might differ, check for general validation failure and mention of the field
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('sourcePath');
    expect(mockCp).not.toHaveBeenCalled();
  });


  // TODO: Add tests for:
  // - Overwrite true/false scenarios (when destination exists)
  // - Multiple items (some succeed, some fail)
  // - Recursive directory copy

  it('should handle ENOENT error when source does not exist', async () => {
    // Arrange
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'nonexistent.txt', destinationPath: 'dest.txt' }],
      overwrite: false, // Add missing overwrite
    };
    const enoentError = new Error('Source does not exist');
    (enoentError as any).code = 'ENOENT';
    mockCp.mockRejectedValue(enoentError);

    // Act
    const result = await copyItemsTool.execute(input, WORKSPACE_ROOT);

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(false);
    expect(result.results[0]!.error).toContain('Source path does not exist');
    expect(result.results[0]!.suggestion).toEqual(expect.any(String)); // Check suggestion exists
    expect(mockCp).toHaveBeenCalledTimes(1);
  });

  it('should handle EEXIST error when destination exists and overwrite is false', async () => {
    // Arrange
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'existing.txt' }],
      overwrite: false, // Explicitly false
    };
    const eexistError = new Error('Destination exists');
    (eexistError as any).code = 'EEXIST';
    mockCp.mockRejectedValue(eexistError);

    // Act
    const result = await copyItemsTool.execute(input, WORKSPACE_ROOT);

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(false);
    expect(result.results[0]!.error).toContain('Destination path already exists and overwrite is false');
    expect(result.results[0]!.suggestion).toEqual(expect.any(String)); // Check suggestion exists
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'source.txt'),
      path.resolve(WORKSPACE_ROOT, 'existing.txt'),
      { recursive: true, force: false, errorOnExist: true } // Check options
    );
  });

  it('should handle generic errors during copy', async () => {
    // Arrange
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'dest.txt' }],
      overwrite: false, // Add overwrite
    };
    const genericError = new Error('Something went wrong');
    mockCp.mockRejectedValue(genericError);

    // Act
    const result = await copyItemsTool.execute(input, WORKSPACE_ROOT);

    // Assert
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(false);
    expect(result.results[0]!.error).toContain('Something went wrong');
    expect(result.results[0]!.suggestion).toEqual(expect.any(String)); // Check suggestion exists
    expect(mockCp).toHaveBeenCalledTimes(1);
  });

  // - Source path does not exist (ENOENT error)
  // - Destination exists and overwrite is false (EEXIST error)
  // - Paths outside workspace root (security check)
  // - Other potential fs errors
});