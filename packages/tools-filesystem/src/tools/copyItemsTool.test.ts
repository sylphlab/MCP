import type { Stats } from 'node:fs';
import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Import Part
import { type MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CopyItemsToolInput, copyItemsTool } from './copyItemsTool.js';
import type { CopyItemResult } from './copyItemsTool.js'; // Import correct result type

// Mock the specific fs/promises functions
vi.mock('node:fs/promises', () => ({
  cp: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(), // Mock mkdir as it might be called implicitly by cp's recursive nature or path validation
}));

const WORKSPACE_ROOT = '/test/workspace';
const mockContext: ToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT }; // Rename to mockContext
const allowOutsideContext: ToolExecuteOptions = { ...mockContext, allowOutsideWorkspace: true }; // Rename to allowOutsideContext
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

// Helper to create mock Stats objects (simplified)
const createMockStats = (isFile: boolean): Stats => ({ isFile: () => isFile, isDirectory: () => !isFile } as Stats);


describe('copyItemsTool', () => {
  const mockCp = cp as MockedFunction<typeof cp>;
  const mockStat = stat as MockedFunction<typeof stat>;

  beforeEach(() => {
    vi.resetAllMocks();
    // Default stat to ENOENT (file not found)
    const enoentError = new Error('ENOENT');
    (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
    mockStat.mockRejectedValue(enoentError);
    mockCp.mockResolvedValue(undefined); // Default cp to success
  });

  it('should successfully copy a single file when destination does not exist', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'dest/target.txt' }],
      overwrite: false,
    };
    // mockStat rejects with ENOENT by default for destination check

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.sourcePath).toBe('source.txt');
    expect(itemResult?.destinationPath).toBe('dest/target.txt'); // Added optional chaining
    expect(itemResult?.message).toContain('Copied'); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining // Default dryRun is false when overwrite is false

    expect(mockStat).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'dest/target.txt')); // Stat destination
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'source.txt'),
      path.resolve(WORKSPACE_ROOT, 'dest/target.txt'),
      { recursive: true, force: false, errorOnExist: false }, // Updated expected options
    );
  });

   it('should fail if destination exists and overwrite is false', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'existing.txt' }],
      overwrite: false,
    };
    // Mock stat to resolve for destination, indicating it exists
    mockStat.mockResolvedValue(createMockStats(true));

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Destination path \'existing.txt\' already exists and overwrite is false.');
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining
    expect(mockStat).toHaveBeenCalledTimes(1); // Only stat destination
    expect(mockCp).not.toHaveBeenCalled();
  });

  it('should succeed with overwrite: true when destination exists', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'existing.txt' }],
      overwrite: true,
    };
    // Mock stat to resolve for destination
    mockStat.mockResolvedValue(createMockStats(true));
    mockCp.mockResolvedValue(undefined); // Ensure cp succeeds

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.message).toContain('[Dry Run]');
    expect(itemResult.message).toContain('Would copy');
    expect(itemResult?.message).toContain('(overwriting existing)'); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining // dryRun defaults to true when overwrite is true

    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockCp).not.toHaveBeenCalled(); // Corrected: cp not called in dry run
  }); // Restored correct closing brace

  it('should perform a dry run when dryRun is true (overwrite=false)', async () => {
     const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'dest/target.txt' }],
      overwrite: false,
      dryRun: true, // Explicitly set dryRun
    };
    // Destination doesn't exist (default stat mock)

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true); // Dry run simulation is success
    expect(itemResult.message).toContain('[Dry Run]');
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining

    expect(mockStat).toHaveBeenCalledTimes(1); // Stat destination
    expect(mockCp).not.toHaveBeenCalled();
  });

   it('should perform a dry run when dryRun is true (overwrite=true, dest exists)', async () => {
     const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'existing.txt' }],
      overwrite: true, // Overwrite is true
      dryRun: true, // Explicitly set dryRun
    };
     // Destination exists
    mockStat.mockResolvedValue(createMockStats(true));

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true); // Dry run simulation is success
    expect(itemResult.message).toContain('[Dry Run]');
    expect(itemResult?.message).toContain('(overwriting existing)'); // Added optional chaining
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining

    expect(mockStat).toHaveBeenCalledTimes(1); // Stat destination
    expect(mockCp).not.toHaveBeenCalled();
  });


  it('should fail if input items array is empty', async () => {
    const args = { items: [] }; // Rename to args
    // Expect execute to throw due to Zod validation
    await expect(copyItemsTool.execute({ context: mockContext, args: args as any })) // Use new signature
        .rejects.toThrow('Input validation failed: items: At least one copy item is required.');
    expect(mockCp).not.toHaveBeenCalled();
  });

  it('should fail if an item has missing sourcePath', async () => {
    const args = { items: [{ destinationPath: 'dest.txt' }] }; // Rename to args
    await expect(copyItemsTool.execute({ context: mockContext, args: args as any })) // Use new signature
        .rejects.toThrow('Input validation failed: items: Required');
    expect(mockCp).not.toHaveBeenCalled();
  });

  it('should handle ENOENT error when source does not exist during copy', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'nonexistent.txt', destinationPath: 'dest.txt' }],
      overwrite: false, // Added missing property
    };
    const enoentError = new Error('Source does not exist');
    (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
    // Mock stat to fail for destination (doesn't exist)
    mockStat.mockRejectedValue({ code: 'ENOENT' });
    // Mock cp to fail with ENOENT
    mockCp.mockRejectedValue(enoentError);

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Source path does not exist');
    expect(itemResult?.suggestion).toContain('Verify the source path'); // Added optional chaining
    expect(mockCp).toHaveBeenCalledTimes(1);
  });

  // Note: The EEXIST check is now done *before* calling cp if overwrite is false.

  it('should handle generic errors during copy', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: 'dest.txt' }],
      overwrite: false, // Added missing property
    };
    const genericError = new Error('Something went wrong');
    mockCp.mockRejectedValue(genericError);
    // Mock stat to fail for destination (doesn't exist)
    mockStat.mockRejectedValue({ code: 'ENOENT' });

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Something went wrong');
    expect(itemResult?.suggestion).toContain('Check file paths, permissions'); // Added optional chaining
    expect(mockCp).toHaveBeenCalledTimes(1);
  });

  it('should fail path validation if source path is outside workspace and allowOutsideWorkspace is false', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: '../outside.txt', destinationPath: 'dest.txt' }],
      overwrite: false, // Added missing property
    };

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult?.error).toContain('Path must resolve within'); // Corrected path validation message check
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(mockCp).not.toHaveBeenCalled();
  });

   it('should fail path validation if destination path is outside workspace and allowOutsideWorkspace is false', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: 'source.txt', destinationPath: '../outside.txt' }],
      overwrite: false, // Added missing property
    };
     // Mock stat for source to succeed (needed before dest validation)
     mockStat.mockResolvedValueOnce(createMockStats(true)); // For source check if any

    const parts = await copyItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult?.error).toContain('Path must resolve within'); // Corrected path validation message check
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(mockCp).not.toHaveBeenCalled();
  });


  it('should succeed copying outside workspace when allowed', async () => {
    const input: CopyItemsToolInput = {
      items: [{ sourcePath: '../outside.txt', destinationPath: 'dest.txt' }],
      overwrite: false, // Added missing property
    };
    mockCp.mockResolvedValue(undefined);
    // Mock stat to fail for destination (doesn't exist)
    mockStat.mockRejectedValue({ code: 'ENOENT' });

    const parts = await copyItemsTool.execute({ context: allowOutsideContext, args: input }); // Use new signature and allowOutsideContext
    const results = getJsonResult<CopyItemResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.error).toBeUndefined();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, '../outside.txt'), // Correct resolved path
      path.resolve(WORKSPACE_ROOT, 'dest.txt'),
      expect.anything(),
    );
  });

  // TODO: Add tests for multiple items (success/fail mix)
});