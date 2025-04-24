import type { Stats } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Import Part
import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MoveRenameItemsToolInput, moveRenameItemsTool } from './moveRenameItemsTool.js';
import type { MoveRenameItemResult } from './moveRenameItemsTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  rename: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const defaultOptions: ToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT };
const allowOutsideOptions: ToolExecuteOptions = { ...defaultOptions, allowOutsideWorkspace: true };

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
  return undefined;
}

// Helper to create mock Stats objects
const createMockStats = (isDirectory: boolean, isFile: boolean): Stats => ({
  isFile: () => isFile,
  isDirectory: () => isDirectory,
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
    mockMkdir.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    // Default stat to ENOENT (file not found)
    const enoentError = new Error('ENOENT');
    (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
    mockStat.mockRejectedValue(enoentError);
  });

  it('should successfully move/rename item when destination does not exist', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'new.txt' }],
      overwrite: false,
    };
    // stat rejects with ENOENT by default

    const parts = await moveRenameItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<MoveRenameItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.sourcePath).toBe('old.txt'); // Added optional chaining
    expect(itemResult?.destinationPath).toBe('new.txt'); // Added optional chaining
    expect(itemResult?.message).toContain('Moved/Renamed'); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining // Default dryRun

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockRm).not.toHaveBeenCalled();
    expect(mockRename).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'old.txt'),
      path.resolve(WORKSPACE_ROOT, 'new.txt'),
    );
  });

  it('should successfully move/rename with overwrite: true when destination exists', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
      overwrite: true,
    };
    mockStat.mockResolvedValue(createMockStats(false, true)); // Destination exists

    const parts = await moveRenameItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<MoveRenameItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.message).toContain('Would move/rename'); // Corrected dry run message check
    expect(itemResult?.message).toContain('(overwriting existing)'); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining // dryRun defaults to true when overwrite is true

    expect(mockMkdir).not.toHaveBeenCalled(); // Corrected: mkdir not called in dry run
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockRm).not.toHaveBeenCalled(); // rm is not called in dry run
    expect(mockRename).not.toHaveBeenCalled(); // rename is not called in dry run
  });

  it('should successfully move/rename with overwrite: true and dryRun: false when destination exists', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
      overwrite: true,
      dryRun: false, // Explicitly not dry run
    };
    mockStat.mockResolvedValue(createMockStats(false, true)); // Destination exists

    const parts = await moveRenameItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<MoveRenameItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.message).toContain('Moved/Renamed'); // Added optional chaining
    expect(itemResult?.message).toContain('(overwrote existing)'); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockRm).toHaveBeenCalledTimes(1); // rm IS called
    expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'existing.txt'), { recursive: true, force: true });
    expect(mockRename).toHaveBeenCalledTimes(1); // rename IS called
    expect(mockRename).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'old.txt'),
      path.resolve(WORKSPACE_ROOT, 'existing.txt'),
    );
  }); // Added missing closing brace for it block

  it('should fail move/rename when destination exists and overwrite: false', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
      overwrite: false,
    };
    mockStat.mockResolvedValue(createMockStats(false, true)); // Destination exists

    const parts = await moveRenameItemsTool.execute(input, defaultOptions); // Corrected variable name
    const results = getJsonResult<MoveRenameItemResult>(parts); // Corrected definition

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.error).toContain('already exists and overwrite is false'); // Added optional chaining
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockMkdir).not.toHaveBeenCalled(); // Corrected: mkdir not called before failure
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockRm).not.toHaveBeenCalled();
    // expect(mockMkdir).toHaveBeenCalledTimes(1); // Removed incorrect assertion
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockRm).not.toHaveBeenCalled();
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('should throw validation error for empty items array', async () => {
    const input = { items: [] };
    await expect(moveRenameItemsTool.execute(input as any, defaultOptions))
        .rejects.toThrow('Input validation failed: items: At least one move/rename item is required.'); // Corrected Zod message
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    // Added missing overwrite property
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'valid.txt', destinationPath: '../outside.txt' }],
      overwrite: false,
    };
    const parts = await moveRenameItemsTool.execute(input, defaultOptions); // allowOutsideWorkspace defaults false
    const results = getJsonResult<MoveRenameItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.error).toContain('Path validation failed'); // Added optional chaining
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining // Default dryRun

    expect(mockRename).not.toHaveBeenCalled();
  });

  it('should handle source does not exist error (from rename)', async () => {
    // Added missing overwrite property
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'nonexistent.txt', destinationPath: 'new.txt' }],
      overwrite: false,
      dryRun: false, // Ensure not dry run to trigger rename
    };
    const renameError = new Error('ENOENT');
    (renameError as NodeJS.ErrnoException).code = 'ENOENT';
    mockRename.mockRejectedValue(renameError);
    // stat rejects with ENOENT (default mock) for destination

    const parts = await moveRenameItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<MoveRenameItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.error).toContain('ENOENT'); // Added optional chaining
    expect(itemResult?.suggestion).toContain('Verify the source path'); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockRename).toHaveBeenCalledTimes(1);
  });

  it('should handle mkdir error', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'new_dir/new.txt' }],
      overwrite: false, // Added missing property
      dryRun: false,
    };
    const mkdirError = new Error('EACCES');
    mockMkdir.mockRejectedValue(mkdirError);
    // stat rejects with ENOENT (default mock) for destination

    const parts = await moveRenameItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<MoveRenameItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.error).toContain('EACCES'); // Added optional chaining
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('should handle rm error during overwrite (not dry run)', async () => {
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
      overwrite: true,
      dryRun: false, // Explicitly not dry run
    };
    mockStat.mockResolvedValue(createMockStats(false, true)); // Destination exists
    const rmError = new Error('EPERM');
    mockRm.mockRejectedValue(rmError); // Mock rm failure

    const parts = await moveRenameItemsTool.execute(input, defaultOptions);
    const results = getJsonResult<MoveRenameItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(false); // Added optional chaining
    expect(itemResult?.error).toContain('EPERM'); // Added optional chaining
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('should succeed moving outside workspace when allowed', async () => {
    // Added missing overwrite property
    const input: MoveRenameItemsToolInput = {
      items: [{ sourcePath: 'valid.txt', destinationPath: '../outside.txt' }],
      overwrite: false,
      dryRun: false,
    };
    // stat rejects with ENOENT (default mock) for destination
    mockRename.mockResolvedValue(undefined);

    const parts = await moveRenameItemsTool.execute(input, allowOutsideOptions);
    const results = getJsonResult<MoveRenameItemResult>(parts); // Added type argument

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult?.success).toBe(true); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockRm).not.toHaveBeenCalled();
    expect(mockRename).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'valid.txt'),
      path.resolve(WORKSPACE_ROOT, '../outside.txt'),
    );
  });
});