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
}

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
    const input: DeleteItemsToolInput = { paths: ['file_to_trash.txt'] }; // useTrash defaults to true
    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.path).toBe('file_to_trash.txt');
    expect(itemResult.message).toContain('moved to trash'); // Dry run message
    expect(itemResult.error).toBeUndefined();
    expect(itemResult.dryRun).toBe(true); // dryRun defaults to true

    expect(mockStat).toHaveBeenCalledTimes(1); // Stat is called to check existence
    expect(mockTrash).not.toHaveBeenCalled(); // Not called in dry run
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should successfully delete a single item using trash (not dry run)', async () => {
    const input: DeleteItemsToolInput = { paths: ['file_to_trash.txt'], useTrash: true, dryRun: false };
    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.path).toBe('file_to_trash.txt');
    expect(itemResult.message).toContain('moved to trash successfully');
    expect(itemResult.error).toBeUndefined();
    expect(itemResult.dryRun).toBe(false);

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
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);
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
    const input: DeleteItemsToolInput = {
      paths: ['file1.txt'],
      useTrash: false,
      dryRun: true, // Explicit dry run
     // Mock stat to resolve (file exists) for clearer dry run message

    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true); // Dry run is success
    expect(itemResult.message).toContain('[Dry Run] Would delete');
        .rejects.toThrow('Input validation failed: paths: Array must contain at least 1 element(s)');
    expect(itemResult.dryRun).toBe(true);
    expect(itemResult.error).toBeUndefined();

    expect(mockStat).toHaveBeenCalledTimes(1); // Stat is called for dry run message
    expect(mockRm).not.toHaveBeenCalled();
    expect(mockTrash).not.toHaveBeenCalled();
  });

  it('should throw validation error for empty paths array', async () => {
    const input = { paths: [] };
    await expect(deleteItemsTool.execute(input as any, defaultOptions))
        .rejects.toThrow('Input validation failed: paths: Array must contain at least 1 element(s)');
    expect(mockTrash).not.toHaveBeenCalled();
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const input: DeleteItemsToolInput = { paths: ['../outside.txt'] };
    const parts = await deleteItemsTool.execute(input, { ...defaultOptions, allowOutsideWorkspace: false });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(itemResult.dryRun).toBe(true); // Default dryRun

    expect(mockTrash).not.toHaveBeenCalled();
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle trash errors', async () => {
    const input: DeleteItemsToolInput = { paths: ['error_file.txt'], useTrash: true, dryRun: false };
    const testError = new Error('Trash failed');
    mockTrash.mockRejectedValue(testError);

    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Failed to trash');
    expect(itemResult.error).toContain('Trash failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(itemResult.dryRun).toBe(false);

    expect(mockTrash).toHaveBeenCalledTimes(1);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('should handle rm errors', async () => {
    const input: DeleteItemsToolInput = { paths: ['error_file.txt'], useTrash: false, dryRun: false };
    const testError = new Error('rm failed');
    mockRm.mockRejectedValue(testError);

    const parts = await deleteItemsTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Failed to delete permanently');
    expect(itemResult.error).toContain('rm failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(itemResult.dryRun).toBe(false);

    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(mockTrash).not.toHaveBeenCalled();
  });

  it('should succeed deleting outside workspace when allowed (using trash)', async () => {
    const input: DeleteItemsToolInput = { paths: ['../outside.txt'], useTrash: true, dryRun: false };
    mockTrash.mockResolvedValue(undefined);
    // Mock stat to resolve for existence check
    mockStat.mockResolvedValue({} as any);

    const parts = await deleteItemsTool.execute(input, { ...defaultOptions, allowOutsideWorkspace: true });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.error).toBeUndefined();
    expect(itemResult.dryRun).toBe(false);

    expect(mockTrash).toHaveBeenCalledTimes(1);
    expect(mockTrash).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'));
    expect(mockRm).not.toHaveBeenCalled();
  });

   it('should succeed deleting outside workspace when allowed (using rm)', async () => {
    const input: DeleteItemsToolInput = { paths: ['../outside.txt'], useTrash: false, dryRun: false };
    mockRm.mockResolvedValue(undefined);

    const parts = await deleteItemsTool.execute(input, { ...defaultOptions, allowOutsideWorkspace: true });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.error).toBeUndefined();
    expect(itemResult.dryRun).toBe(false);

    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'), { recursive: true, force: true });
    expect(mockTrash).not.toHaveBeenCalled();
  });

  // TODO: Add tests for glob support once implemented
  // TODO: Add tests for recursive false when using rm
});