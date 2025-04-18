import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { writeFile, appendFile, mkdir } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import { writeFilesTool, WriteFilesToolInput, WriteFileResult } from './writeFilesTool';

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  appendFile: vi.fn(),
  mkdir: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

describe('writeFilesTool', () => {
  const mockWriteFile = vi.mocked(writeFile);
  const mockAppendFile = vi.mocked(appendFile);
  const mockMkdir = vi.mocked(mkdir);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockMkdir.mockResolvedValue(undefined); // Assume mkdir succeeds
    mockWriteFile.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);
  });

  // Helper
  const createInput = (items: { path: string; content: string }[], options: Partial<Omit<WriteFilesToolInput, 'items'>> = {}): WriteFilesToolInput => ({
      items,
      encoding: options.encoding ?? 'utf-8', // Add defaults for type safety
      append: options.append ?? false, // Add defaults for type safety
  });

  it('should write a single file with utf-8 encoding by default', async () => {
    const input = createInput([{ path: 'file.txt', content: 'Hello' }]);
    const expectedPath = path.resolve(WORKSPACE_ROOT, 'file.txt');
    const expectedOptions = { encoding: 'utf-8' };

    const result = await writeFilesTool.execute(input, WORKSPACE_ROOT);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.path).toBe('file.txt');
    expect(result.results[0]?.message).toContain('File written');
    expect(mockMkdir).toHaveBeenCalledTimes(1); // Ensure parent dir creation called
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, 'Hello', expectedOptions);
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should write a single file with base64 encoding', async () => {
    const contentBase64 = Buffer.from('Hello').toString('base64');
    const input = createInput([{ path: 'file.bin', content: contentBase64 }], { encoding: 'base64' });
    const expectedPath = path.resolve(WORKSPACE_ROOT, 'file.bin');
    const expectedOptions = { encoding: 'base64' };

    const result = await writeFilesTool.execute(input, WORKSPACE_ROOT);

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, contentBase64, expectedOptions);
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should append content to a file', async () => {
    const input = createInput([{ path: 'log.txt', content: 'More data' }], { append: true });
    const expectedPath = path.resolve(WORKSPACE_ROOT, 'log.txt');
    const expectedOptions = { encoding: 'utf-8' };

    const result = await writeFilesTool.execute(input, WORKSPACE_ROOT);

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.message).toContain('Content appended');
    expect(mockAppendFile).toHaveBeenCalledTimes(1);
    expect(mockAppendFile).toHaveBeenCalledWith(expectedPath, 'More data', expectedOptions);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should write multiple files', async () => {
    const input = createInput([
      { path: 'file1.txt', content: 'Content 1' },
      { path: 'sub/file2.js', content: 'Content 2' },
    ]);

    const result = await writeFilesTool.execute(input, WORKSPACE_ROOT);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[1]?.success).toBe(true);
    expect(mockMkdir).toHaveBeenCalledTimes(2); // Called for each file's parent dir
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file1.txt'), 'Content 1', { encoding: 'utf-8' });
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'sub/file2.js'), 'Content 2', { encoding: 'utf-8' });
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should return validation error for empty items array', async () => {
    const input = { items: [] }; // Invalid input
    const result = await writeFilesTool.execute(input as any, WORKSPACE_ROOT);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('items array cannot be empty');
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const input = createInput([{ path: '../secret.txt', content: 'hacked' }]);
    const result = await writeFilesTool.execute(input, WORKSPACE_ROOT);
    expect(result.success).toBe(false); // Overall success is false
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('Path validation failed');
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should handle mkdir error', async () => {
    const input = createInput([{ path: 'no_access/file.txt', content: 'test' }]);
    const mkdirError = new Error('EACCES');
    mockMkdir.mockRejectedValue(mkdirError);

    const result = await writeFilesTool.execute(input, WORKSPACE_ROOT);

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('EACCES');
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should handle writeFile error', async () => {
    const input = createInput([{ path: 'read_only/file.txt', content: 'test' }]);
    const writeError = new Error('EROFS');
    mockWriteFile.mockRejectedValue(writeError);

    const result = await writeFilesTool.execute(input, WORKSPACE_ROOT);

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('EROFS');
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should handle appendFile error', async () => {
    const input = createInput([{ path: 'read_only/file.txt', content: 'test' }], { append: true });
    const appendError = new Error('EROFS');
    mockAppendFile.mockRejectedValue(appendError);

    const result = await writeFilesTool.execute(input, WORKSPACE_ROOT);

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain('EROFS');
    expect(mockAppendFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  // TODO: Add tests for multiple items with mixed results
});