import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Import Part
import { type MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CreateFolderToolInput, createFolderTool } from './createFolderTool.js';
import type { CreateFolderResult } from './createFolderTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const mockContext: ToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT }; // Rename to mockContext
// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  // console.log('DEBUG: getJsonResult received parts:', JSON.stringify(parts, null, 2)); // Keep commented for now
  const jsonPart = parts.find((part) => part.type === 'json');
  // console.log('DEBUG: Found jsonPart:', JSON.stringify(jsonPart, null, 2)); // Keep commented for now
  // Check if jsonPart exists and has a 'value' property (which holds the actual data)
  if (jsonPart && jsonPart.value !== undefined) {
    // console.log('DEBUG: typeof jsonPart.value:', typeof jsonPart.value); // Keep commented for now
    // console.log('DEBUG: Attempting to use jsonPart.value directly'); // Keep commented for now
    try {
      // Assuming the value is already the correct array type based on defineTool's outputSchema
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  // console.log('DEBUG: jsonPart or jsonPart.value is undefined or null.'); // Keep commented for now
  return undefined;
}

describe('createFolderTool', () => {
  const mockMkdir = mkdir as MockedFunction<typeof mkdir>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockMkdir.mockResolvedValue(undefined); // Default mkdir to success
  });

  it('should successfully create a single folder', async () => {
    const args: CreateFolderToolInput = { folderPaths: ['new/folder'] }; // Rename to args
    const parts = await createFolderTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<CreateFolderResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.path).toBe('new/folder');
    expect(itemResult.error).toBeUndefined();
    expect(itemResult.message).toContain('Folder created successfully');

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'new/folder'), {
      recursive: true,
    });
  });

  it('should successfully create multiple folders', async () => {
    const args: CreateFolderToolInput = { folderPaths: ['folder1', 'folder2/sub'] }; // Rename to args
    const parts = await createFolderTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<CreateFolderResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);
    expect(results?.[0]?.success).toBe(true);
    expect(results?.[1]?.success).toBe(true);

    expect(mockMkdir).toHaveBeenCalledTimes(2);
    expect(mockMkdir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'folder1'), {
      recursive: true,
    });
    expect(mockMkdir).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'folder2/sub'), {
      recursive: true,
    });
  });

  it('should throw validation error for empty folderPaths array', async () => {
    const args = { folderPaths: [] }; // Rename to args
    await expect(createFolderTool.execute({ context: mockContext, args: args as any })).rejects.toThrow( // Use new signature
      'Input validation failed: folderPaths: folderPaths array cannot be empty.',
    );
    expect(mockMkdir).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const args: CreateFolderToolInput = { folderPaths: ['../outside'] }; // Rename to args
    const parts = await createFolderTool.execute({ // Use new signature
      context: { ...mockContext, allowOutsideWorkspace: false }, // Pass context directly
      args,
    });
    const results = getJsonResult<CreateFolderResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockMkdir).not.toHaveBeenCalled();
  });

  it('should handle mkdir errors', async () => {
    const input: CreateFolderToolInput = { folderPaths: ['valid/path', 'error/path'] };
    const testError = new Error('Permission denied');
    mockMkdir.mockResolvedValueOnce(undefined).mockRejectedValueOnce(testError);

    const parts = await createFolderTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CreateFolderResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);

    // First item (success)
    const itemResult1 = results?.[0];
    expect(itemResult1).toBeDefined(); // Add check
    if (!itemResult1) return; // Type guard
    expect(itemResult1.success).toBe(true);
    expect(itemResult1.path).toBe('valid/path');
    expect(itemResult1.error).toBeUndefined();

    // Second item (failure)
    const itemResult2 = results?.[1];
    expect(itemResult2).toBeDefined(); // Add check
    if (!itemResult2) return; // Type guard
    expect(itemResult2.success).toBe(false);
    expect(itemResult2.path).toBe('error/path');
    expect(itemResult2.error).toContain('Permission denied');
    expect(itemResult2.suggestion).toEqual(expect.any(String));

    expect(mockMkdir).toHaveBeenCalledTimes(2);
  });

  it('should succeed creating folder outside workspace when allowed', async () => {
    const input: CreateFolderToolInput = { folderPaths: ['../outside/new'] };
    mockMkdir.mockResolvedValue(undefined);

    const parts = await createFolderTool.execute({ // Use new signature
      context: { ...mockContext, allowOutsideWorkspace: true }, // Pass context directly
      args: input,
    });
    const results = getJsonResult<CreateFolderResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.error).toBeUndefined();

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, '../outside/new'), // Check resolved path
      { recursive: true },
    );
  });
});
