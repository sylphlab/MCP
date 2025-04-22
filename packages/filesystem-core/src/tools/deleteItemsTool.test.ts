import type { Stats } from 'node:fs'; // Import Stats type
import { rm, stat } from 'node:fs/promises'; // Import stat as well
import path from 'node:path';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part
import trash from 'trash';
import { type MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type DeleteItemsToolInput, deleteItemsTool } from './deleteItemsTool.js';
import type { DeleteItemResult } from './deleteItemsTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  rm: vi.fn(),
  stat: vi.fn(), // Mock stat
}));

// Mock the trash module
vi.mock('trash', () => ({
  default: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT }; // Ensure this is defined correctly
const allowOutsideOptions: McpToolExecuteOptions = { ...defaultOptions, allowOutsideWorkspace: true };

// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  // console.log('DEBUG: getJsonResult received parts:', JSON.stringify(parts, null, 2)); // Keep commented for now
  const jsonPart = parts.find(part => part.type === 'json');
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
  return undefined; // Return undefined if no json part or value
}

// Helper to create mock Stats objects (simplified) - Removed as unused


describe('deleteItemsTool', () => {
  const mockRm = rm as MockedFunction<typeof rm>;
  const mockTrash = trash as MockedFunction<typeof trash>;
  const mockStat = stat as MockedFunction<typeof stat>; // Mock stat

  beforeEach(() => {
    vi.resetAllMocks();
    // Default stat to resolve (file exists) for trash tests, reject for rm tests initially
    mockStat.mockResolvedValue({} as any); // Default exists for trash
    mockRm.mockResolvedValue(undefined); // Default rm to success
    mockTrash.mockResolvedValue(undefined); // Default trash to success
  });

  it('should successfully delete a single item using trash (default)', async () => {
    // Input type requires recursive and useTrash, providing defaults
    const input: DeleteItemsToolInput = { paths: ['file_to_trash.txt'], recursive: true, useTrash: true }; // useTrash defaults to true conceptually, but type requires it
    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.path).toBe('file_to_trash.txt'); // Added optional chaining
    expect(itemResult?.message).toContain('Would move'); // Corrected dry run message check
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining // dryRun defaults to true

    expect(mockStat).toHaveBeenCalledTimes(1); // Stat is called to check existence
    expect(mockTrash).not.toHaveBeenCalled(); // Not called in dry run
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should successfully delete a single item using trash (not dry run)', async () => {
    // Added missing recursive property
    const input: DeleteItemsToolInput = { paths: ['file_to_trash.txt'], useTrash: true, dryRun: false, recursive: true };
    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.path).toBe('file_to_trash.txt'); // Added optional chaining
    expect(itemResult?.message).toContain('moved to trash successfully'); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockTrash).toHaveBeenCalledTimes(1);
    expect(mockTrash).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file_to_trash.txt'));
    expect(mockRm).not.toHaveBeenCalled();
  });


  it('should successfully delete multiple items permanently (not dry run)', async () => {
    const input: DeleteItemsToolInput = {
      paths: ['file1.txt', 'folder_to_delete'],
      useTrash: false,
      recursive: true,
      dryRun: false, // Explicitly not dry run
    };
    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);
    // Added optional chaining for safety, although results should be defined here
    expect(results?.[0]?.success).toBe(true);
    expect(results?.[0]?.message).toContain('deleted permanently');
    expect(results?.[1]?.success).toBe(true);
    expect(results?.[1]?.message).toContain('deleted permanently');
    expect(results?.[0]?.dryRun).toBe(false);
    expect(results?.[1]?.dryRun).toBe(false);

    expect(mockStat).not.toHaveBeenCalled(); // Stat not needed for rm with force:true
    expect(mockRm).toHaveBeenCalledTimes(2);
    expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file1.txt'), { recursive: true, force: true });
    expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'folder_to_delete'), { recursive: true, force: true });
    expect(mockTrash).not.toHaveBeenCalled();
  });

   it('should perform dry run for permanent delete', async () => {
    // Added missing recursive property
    const input: DeleteItemsToolInput = {
      paths: ['file1.txt'],
      useTrash: false,
      recursive: true, // Added missing property
      dryRun: true, // Explicit dry run
    };
     // Mock stat to resolve (file exists) for clearer dry run message
     // mockStat.mockResolvedValue({} as any); // Already default in beforeEach

    const parts = await deleteItemsTool.execute(input, defaultOptions); // Restored correct syntax
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining // Dry run is success
    expect(itemResult?.message).toContain('[Dry Run] Would delete'); // Added optional chaining
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining

    expect(mockStat).toHaveBeenCalledTimes(1); // Stat is called for dry run message
    expect(mockRm).not.toHaveBeenCalled();
    expect(mockTrash).not.toHaveBeenCalled();
  }); // Restored closing bracket

  it('should throw validation error for empty paths array', async () => {
    const input = { paths: [] };
    await expect(deleteItemsTool.execute(input as any, defaultOptions))
        .rejects.toThrow('Input validation failed: paths: paths array cannot be empty.'); // Corrected Zod message
    expect(mockTrash).not.toHaveBeenCalled();
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    // Added missing properties
    const input: DeleteItemsToolInput = { paths: ['../outside.txt'], recursive: true, useTrash: true };
    const parts = await deleteItemsTool.execute(input, { ...defaultOptions, allowOutsideWorkspace: false });
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.error).toContain('Path validation failed'); // Added optional chaining
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining // Default dryRun

    expect(mockTrash).not.toHaveBeenCalled();
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle trash errors', async () => {
    // Added missing recursive property
    const input: DeleteItemsToolInput = { paths: ['error_file.txt'], useTrash: true, dryRun: false, recursive: true };
    const testError = new Error('Trash failed');
    mockTrash.mockRejectedValue(testError);
    // Mock stat needed for trash execution path
    mockStat.mockResolvedValue({} as any);

    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.error).toContain('Failed to trash'); // Added optional chaining
    expect(itemResult?.error).toContain('Trash failed'); // Added optional chaining
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockTrash).toHaveBeenCalledTimes(1);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle rm errors', async () => {
    // Added missing recursive property
    const input: DeleteItemsToolInput = { paths: ['error_file.txt'], useTrash: false, dryRun: false, recursive: true };
    const testError = new Error('rm failed');
    mockRm.mockRejectedValue(testError);

    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.error).toContain('Failed to delete permanently'); // Added optional chaining
    expect(itemResult?.error).toContain('rm failed'); // Added optional chaining
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(mockTrash).not.toHaveBeenCalled();
  });

  it('should succeed deleting outside workspace when allowed (using trash)', async () => {
    // Added missing recursive property
    const input: DeleteItemsToolInput = { paths: ['../outside.txt'], useTrash: true, dryRun: false, recursive: true };
    mockTrash.mockResolvedValue(undefined);
    // Mock stat to resolve for existence check
    mockStat.mockResolvedValue({} as any);

    const parts = await deleteItemsTool.execute(input, { ...defaultOptions, allowOutsideWorkspace: true });
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockTrash).toHaveBeenCalledTimes(1);
    expect(mockTrash).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'));
    expect(mockRm).not.toHaveBeenCalled();
  });

   it('should succeed deleting outside workspace when allowed (using rm)', async () => {
    // Added missing recursive property
    const input: DeleteItemsToolInput = { paths: ['../outside.txt'], useTrash: false, dryRun: false, recursive: true };
    mockRm.mockResolvedValue(undefined);

    const parts = await deleteItemsTool.execute(input, { ...defaultOptions, allowOutsideWorkspace: true });
    const results = getJsonResult<DeleteItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'), { recursive: true, force: true });
    expect(mockTrash).not.toHaveBeenCalled();
  });

  // TODO: Add tests for glob support once implemented
  // TODO: Add tests for recursive false when using rm
});