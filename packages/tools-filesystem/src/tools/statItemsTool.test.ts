import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Import Part
import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type StatItemsToolInput, statItemsTool } from './statItemsTool.js';
import type { StatItemResult } from './statItemsTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const mockContext: ToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT }; // Rename to mockContext
const allowOutsideContext: ToolExecuteOptions = { // Rename to allowOutsideContext
  ...mockContext,
  allowOutsideWorkspace: true,
};
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

// Helper to create mock Stats objects
const createMockStats = (isFile: boolean): Stats =>
  ({
    isFile: () => isFile,
    isDirectory: () => !isFile,
    size: 99,
  }) as Stats;

describe('statItemsTool', () => {
  const mockStat = vi.mocked(stat);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock to success
    mockStat.mockResolvedValue(createMockStats(true));
  });

  it('should successfully get stats for a single item', async () => {
    const input: StatItemsToolInput = { paths: ['file.txt'] };
    const mockStatsData = createMockStats(true);
    mockStat.mockResolvedValue(mockStatsData);

    const parts = await statItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<StatItemResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.path).toBe('file.txt');
    expect(itemResult.stat).toEqual(mockStatsData);
    expect(itemResult.error).toBeUndefined();

    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockStat).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'));
  });

  it('should successfully get stats for multiple items', async () => {
    const input: StatItemsToolInput = { paths: ['file1.txt', 'dir/file2.png'] };
    const mockStats1 = createMockStats(true);
    const mockStats2 = createMockStats(true);
    mockStat.mockResolvedValueOnce(mockStats1).mockResolvedValueOnce(mockStats2);

    const parts = await statItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<StatItemResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);
    expect(results?.[0]?.success).toBe(true);
    expect(results?.[0]?.stat).toEqual(mockStats1);
    expect(results?.[1]?.success).toBe(true);
    expect(results?.[1]?.stat).toEqual(mockStats2);
    expect(mockStat).toHaveBeenCalledTimes(2);
  });

  it('should handle non-existent path (ENOENT) gracefully', async () => {
    const input: StatItemsToolInput = { paths: ['nonexistent.txt'] };
    const enoentError = new Error('ENOENT');
    (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
    mockStat.mockRejectedValue(enoentError);

    const parts = await statItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<StatItemResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.stat).toBeUndefined();
    expect(itemResult.error).toContain("Path 'nonexistent.txt' not found");
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockStat).toHaveBeenCalledTimes(1);
  });

  it('should handle other stat errors', async () => {
    const input: StatItemsToolInput = { paths: ['no_access.txt'] };
    const accessError = new Error('EACCES');
    (accessError as NodeJS.ErrnoException).code = 'EACCES';
    mockStat.mockRejectedValue(accessError);

    const parts = await statItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<StatItemResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.stat).toBeUndefined();
    expect(itemResult.error).toContain('Failed to get stats');
    expect(itemResult.error).toContain('EACCES');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockStat).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple items with mixed results (found and not found)', async () => {
    const input: StatItemsToolInput = { paths: ['found.txt', 'not_found.txt'] };
    const mockStatsFound = createMockStats(true);
    const enoentError = new Error('ENOENT');
    (enoentError as NodeJS.ErrnoException).code = 'ENOENT';

    mockStat.mockResolvedValueOnce(mockStatsFound).mockRejectedValueOnce(enoentError);

    const parts = await statItemsTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<StatItemResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);

    // First item (success)
    const itemResult1 = results?.[0];
    expect(itemResult1).toBeDefined(); // Add check
    if (!itemResult1) return; // Type guard
    expect(itemResult1.success).toBe(true);
    expect(itemResult1.stat).toEqual(mockStatsFound);
    expect(itemResult1.error).toBeUndefined();

    // Second item (not found)
    const itemResult2 = results?.[1];
    expect(itemResult2).toBeDefined(); // Add check
    if (!itemResult2) return; // Type guard
    expect(itemResult2.success).toBe(false);
    expect(itemResult2.stat).toBeUndefined();
    expect(itemResult2.error).toContain('not found');
    expect(itemResult2.suggestion).toEqual(expect.any(String));

    expect(mockStat).toHaveBeenCalledTimes(2);
  });

  it('should throw validation error for empty paths array', async () => {
    const args = { paths: [] }; // Rename to args
    await expect(statItemsTool.execute({ context: mockContext, args: args as any })).rejects.toThrow( // Use new signature
      'Input validation failed: paths: paths array cannot be empty.',
    );
    expect(mockStat).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const args: StatItemsToolInput = { paths: ['../outside.txt'] }; // Rename to args
    const parts = await statItemsTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<StatItemResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockStat).not.toHaveBeenCalled();
  });

  it('should allow stat outside workspace when allowOutsideWorkspace is true', async () => {
    const args: StatItemsToolInput = { paths: ['../outside.txt'] }; // Rename to args
    const mockStatsData = createMockStats(true);
    mockStat.mockResolvedValue(mockStatsData);

    const parts = await statItemsTool.execute({ context: allowOutsideContext, args }); // Use new signature and allowOutsideContext
    const results = getJsonResult<StatItemResult>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.error).toBeUndefined();
    expect(itemResult.stat).toEqual(mockStatsData);
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockStat).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'));
  });
});
