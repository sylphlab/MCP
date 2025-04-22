import type { Stats } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part
import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReadFilesToolInput, readFilesTool } from './readFilesTool.js';
import type { ReadFileResult } from './readFilesTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT };
const allowOutsideOptions: McpToolExecuteOptions = {
  ...defaultOptions,
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
    size: 42, // Add default size
  }) as Stats;

describe('readFilesTool', () => {
  const mockReadFile = vi.mocked(readFile);
  const mockStat = vi.mocked(stat);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockStat.mockResolvedValue(createMockStats(true)); // Assume path exists and is file by default
    mockReadFile.mockResolvedValue(Buffer.from('')); // Default to empty buffer
  });

  it('should read a single file with utf-8 encoding by default', async () => {
    const input: ReadFilesToolInput = { paths: ['file.txt'] }; // Defaults handled by schema/tool
    const fileContent = 'Hello World!';
    mockReadFile.mockResolvedValue(Buffer.from(fileContent, 'utf-8'));

    const parts = await readFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.path).toBe('file.txt');
    expect(itemResult.content).toBe(fileContent);
    expect(itemResult.stat).toBeUndefined();
    expect(itemResult.error).toBeUndefined();

    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'));
    expect(mockStat).not.toHaveBeenCalled(); // Not called if includeStats is false (default)
  });

  it('should read a single file with base64 encoding', async () => {
    const input: ReadFilesToolInput = { paths: ['file.bin'], encoding: 'base64' };
    const fileContentUtf8 = 'Hello Binary!';
    const fileContentBase64 = Buffer.from(fileContentUtf8).toString('base64');
    mockReadFile.mockResolvedValue(Buffer.from(fileContentUtf8)); // Mock returns raw buffer

    const parts = await readFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.content).toBe(fileContentBase64); // Tool encodes to base64 string
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('should read multiple files', async () => {
    const input: ReadFilesToolInput = { paths: ['file1.txt', 'file2.txt'] };
    mockReadFile
      .mockResolvedValueOnce(Buffer.from('Content 1'))
      .mockResolvedValueOnce(Buffer.from('Content 2'));

    const parts = await readFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);
    expect(results?.[0]?.success).toBe(true);
    expect(results?.[0]?.content).toBe('Content 1');
    expect(results?.[1]?.success).toBe(true);
    expect(results?.[1]?.content).toBe('Content 2');
    expect(mockReadFile).toHaveBeenCalledTimes(2);
  });

  it('should include stats when requested', async () => {
    const input: ReadFilesToolInput = { paths: ['file.txt'], includeStats: true };
    const mockFileStats = createMockStats(true); // isFile = true
    mockStat.mockResolvedValue(mockFileStats);
    mockReadFile.mockResolvedValue(Buffer.from('content'));

    const parts = await readFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.stat).toBeDefined();
    expect(itemResult.stat?.size).toBe(42);
    expect(mockStat).toHaveBeenCalledTimes(1); // Called once for the file
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('should fail if includeStats is true and path is not a file', async () => {
    const input: ReadFilesToolInput = { paths: ['dir'], includeStats: true };
    mockStat.mockResolvedValue(createMockStats(false)); // Mock stat says it's a directory

    const parts = await readFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('is not a file');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should throw validation error for empty paths array', async () => {
    const input = { paths: [] };
    await expect(readFilesTool.execute(input as any, defaultOptions)).rejects.toThrow(
      'Input validation failed: paths: paths array cannot be empty.',
    );
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const input: ReadFilesToolInput = { paths: ['../outside.txt'] };
    const parts = await readFilesTool.execute(input, defaultOptions); // allowOutsideWorkspace defaults false
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should handle non-existent file error (ENOENT)', async () => {
    const input: ReadFilesToolInput = { paths: ['nonexistent.txt'] };
    const readError = new Error('ENOENT');
    (readError as NodeJS.ErrnoException).code = 'ENOENT';
    mockReadFile.mockRejectedValue(readError);
    // Stat might be called if includeStats=true, mock it to fail similarly if needed
    mockStat.mockRejectedValue(readError);

    const parts = await readFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('File not found');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockReadFile).toHaveBeenCalledTimes(1); // ReadFile is attempted
  });

  it('should handle path is directory error (EISDIR)', async () => {
    const input: ReadFilesToolInput = { paths: ['directory'] };
    const readError = new Error('EISDIR');
    (readError as NodeJS.ErrnoException).code = 'EISDIR';
    mockReadFile.mockRejectedValue(readError);
    // Mock stat to indicate it's a directory if includeStats=true
    mockStat.mockResolvedValue(createMockStats(false));

    const parts = await readFilesTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path is a directory');
    expect(itemResult.suggestion).toEqual(expect.any(String));
    expect(mockReadFile).toHaveBeenCalledTimes(1); // ReadFile is attempted
  });

  it('should succeed reading outside workspace when allowed', async () => {
    const input: ReadFilesToolInput = { paths: ['../outside.txt'] };
    const fileContent = 'Outside!';
    mockReadFile.mockResolvedValue(Buffer.from(fileContent, 'utf-8'));
    mockStat.mockResolvedValue(createMockStats(true)); // Mock stat to succeed

    const parts = await readFilesTool.execute(input, allowOutsideOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.error).toBeUndefined();
    expect(itemResult.content).toBe(fileContent);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'));
  });

  // TODO: Add tests for includeLineNumbers, includeHash
  // TODO: Add tests for multiple files where some succeed and some fail
});
