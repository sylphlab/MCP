import { createHash } from 'node:crypto'; // Import crypto for hash tests
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Import Part
import { MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type WriteFilesToolInput, writeFilesTool } from './writeFilesTool.js';
import type { WriteFileResult } from './writeFilesTool.js'; // Import correct result type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  appendFile: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(), // Mock readFile for hash check tests
  stat: vi.fn(),     // Mock stat for hash check tests
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

// Helper to calculate hash
const calculateHash = (content: string) => createHash('sha256').update(content).digest('hex');

describe('writeFilesTool', () => {
  const mockWriteFile = vi.mocked(writeFile);
  const mockAppendFile = vi.mocked(appendFile);
  const mockMkdir = vi.mocked(mkdir);
  const mockReadFile = vi.mocked(readFile);
  const mockStat = vi.mocked(stat);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);
    // Default readFile/stat for hash checks (e.g., file doesn't exist initially)
    const enoentError = new Error('ENOENT');
    (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
    mockReadFile.mockRejectedValue(enoentError);
    mockStat.mockRejectedValue(enoentError);
  });

  const createInput = (
    items: { path: string; content: string; expectedHash?: string }[],
    options: Partial<Omit<WriteFilesToolInput, 'items'>> = {},
  ): WriteFilesToolInput => ({
    items,
    encoding: options.encoding ?? 'utf-8',
    append: options.append ?? false,
    dryRun: options.dryRun,
  });

  it('should write a single file with utf-8 encoding by default', async () => {
    const input = createInput([{ path: 'file.txt', content: 'Hello' }], { dryRun: false });
    const expectedPath = path.resolve(WORKSPACE_ROOT, 'file.txt');
    const expectedBuffer = Buffer.from('Hello', 'utf-8');
    const expectedOptions = { encoding: 'utf-8' };

    const parts = await writeFilesTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.path).toBe('file.txt');
    expect(itemResult?.message).toContain('File written successfully'); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, expectedBuffer, expectedOptions);
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should write a single file with base64 encoding', async () => {
    const contentUtf8 = 'Hello Base64';
    const contentBase64 = Buffer.from(contentUtf8).toString('base64');
    const input = createInput([{ path: 'file.bin', content: contentBase64 }], {
      encoding: 'base64',
      dryRun: false,
    });
    const expectedPath = path.resolve(WORKSPACE_ROOT, 'file.bin');
    const expectedBuffer = Buffer.from(contentBase64, 'base64');
    const expectedOptions = { encoding: 'base64' };

    const parts = await writeFilesTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.dryRun).toBe(false);

    expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, expectedBuffer, expectedOptions);
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should append content to a file', async () => {
    const input = createInput([{ path: 'log.txt', content: 'More data' }], { append: true, dryRun: false });
    const expectedPath = path.resolve(WORKSPACE_ROOT, 'log.txt');
    const expectedBuffer = Buffer.from('More data', 'utf-8');
    const expectedOptions = { encoding: 'utf-8' };

    const parts = await writeFilesTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.message).toContain('Content appended successfully');
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockAppendFile).toHaveBeenCalledTimes(1);
    expect(mockAppendFile).toHaveBeenCalledWith(expectedPath, expectedBuffer, expectedOptions);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should write multiple files', async () => {
    const input = createInput([
      { path: 'file1.txt', content: 'Content 1' },
      { path: 'sub/file2.js', content: 'Content 2' },
    ], { dryRun: false });

    const parts = await writeFilesTool.execute({ context: mockContext, args: input }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(2);
    expect(results?.[0]?.success).toBe(true);
    expect(results?.[1]?.success).toBe(true);

    expect(mockMkdir).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'file1.txt'),
      Buffer.from('Content 1', 'utf-8'),
      { encoding: 'utf-8' },
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      path.resolve(WORKSPACE_ROOT, 'sub/file2.js'),
      Buffer.from('Content 2', 'utf-8'),
      { encoding: 'utf-8' },
    );
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

   it('should perform a dry run for write', async () => {
    const args = createInput([{ path: 'file.txt', content: 'Hello' }], { dryRun: true }); // Rename to args

    const parts = await writeFilesTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard

    expect(itemResult.success).toBe(true);
    expect(itemResult.message).toContain('[Dry Run] Would write file');
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining and uncommented
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining and uncommented

    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  }); // Added missing closing brace

   it('should perform a dry run for append', async () => {
    const args = createInput([{ path: 'log.txt', content: 'More data' }], { append: true, dryRun: true }); // Rename to args

    const parts = await writeFilesTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

     expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.message).toContain('[Dry Run] Would append to file');
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining
    expect(itemResult?.error).toBeUndefined(); // Added optional chaining

    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  });


  it('should throw validation error for empty items array', async () => {
    const args = { items: [] }; // Rename to args
    await expect(writeFilesTool.execute({ context: mockContext, args: args as any })) // Use new signature
        .rejects.toThrow('Input validation failed: items: At least one file item is required.');
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should handle path validation failure (outside workspace)', async () => {
    const args = createInput([{ path: '../secret.txt', content: 'hacked' }]); // Rename to args
    const parts = await writeFilesTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(true); // Added optional chaining // Default dryRun for write

    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should handle mkdir error', async () => {
    const args = createInput([{ path: 'no_access/file.txt', content: 'test' }], { dryRun: false }); // Rename to args
    const mkdirError = new Error('EACCES');
    mockMkdir.mockRejectedValue(mkdirError);

    const parts = await writeFilesTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('EACCES');
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should handle writeFile error', async () => {
    const args = createInput([{ path: 'read_only/file.txt', content: 'test' }], { dryRun: false }); // Rename to args
    const writeError = new Error('EROFS');
    mockWriteFile.mockRejectedValue(writeError);

    const parts = await writeFilesTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('EROFS');
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should handle appendFile error', async () => {
    const args = createInput([{ path: 'read_only/file.txt', content: 'test' }], { append: true, dryRun: false }); // Rename to args
    const appendError = new Error('EROFS');
    mockAppendFile.mockRejectedValue(appendError);

    const parts = await writeFilesTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.error).toContain('EROFS');
    expect(itemResult?.suggestion).toEqual(expect.any(String)); // Added optional chaining
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockAppendFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should handle hash mismatch error during overwrite', async () => {
      const filePath = 'file.txt';
      const originalContent = 'Original';
      const newContent = 'New';
      const originalHash = calculateHash(originalContent);
      const wrongHash = 'wronghash';

      mockReadFile.mockResolvedValue(Buffer.from(originalContent)); // Mock read for hash check
  
      const args = createInput([{ path: filePath, content: newContent, expectedHash: wrongHash }], { append: false, dryRun: false }); // Rename to args
  
      const parts = await writeFilesTool.execute({ context: mockContext, args }); // Use new signature
      const results = getJsonResult<WriteFileResult>(parts);
  
      expect(results).toBeDefined();
      expect(results).toHaveLength(1);
      const itemResult = results?.[0];
      expect(itemResult).toBeDefined(); // Add check
      if (!itemResult) return; // Type guard
      expect(itemResult.success).toBe(false);
      expect(itemResult.error).toContain('File hash mismatch');
      expect(itemResult?.suggestion).toContain('File content has changed'); // Added optional chaining
      expect(itemResult?.oldHash).toBe(originalHash); // Added optional chaining
      expect(itemResult?.newHash).toBeUndefined(); // Added optional chaining
      expect(itemResult?.dryRun).toBe(false); // Added optional chaining

      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockAppendFile).not.toHaveBeenCalled();
  });

   it('should succeed overwrite if hash matches', async () => {
      const filePath = 'file.txt';
      const originalContent = 'Original';
      const newContent = 'New';
      const originalHash = calculateHash(originalContent);
      const newHash = calculateHash(newContent);

      mockReadFile.mockResolvedValue(Buffer.from(originalContent)); // Mock read for hash check
  
      const args = createInput([{ path: filePath, content: newContent, expectedHash: originalHash }], { append: false, dryRun: false }); // Rename to args
  
      const parts = await writeFilesTool.execute({ context: mockContext, args }); // Use new signature
      const results = getJsonResult<WriteFileResult>(parts);
  
      expect(results).toBeDefined();
      expect(results).toHaveLength(1);
      const itemResult = results?.[0];
      expect(itemResult).toBeDefined(); // Add check
      if (!itemResult) return; // Type guard
      expect(itemResult.success).toBe(true);
      expect(itemResult.message).toContain('File written successfully');
      expect(itemResult?.oldHash).toBe(originalHash); // Added optional chaining
      expect(itemResult?.newHash).toBe(newHash); // Added optional chaining
      expect(itemResult?.error).toBeUndefined(); // Added optional chaining
      expect(itemResult?.dryRun).toBe(false); // Added optional chaining

      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), Buffer.from(newContent), expect.any(Object));
      expect(mockAppendFile).not.toHaveBeenCalled();
  });

  it('should allow writing outside workspace when allowOutsideWorkspace is true', async () => {
    const args = createInput([{ path: '../outside.txt', content: 'allowed' }], { dryRun: false }); // Rename to args
    const expectedPath = path.resolve(WORKSPACE_ROOT, '../outside.txt');
    const expectedBuffer = Buffer.from('allowed', 'utf-8');
    const expectedOptions = { encoding: 'utf-8' };

    const parts = await writeFilesTool.execute({ context: allowOutsideContext, args }); // Use new signature and allowOutsideContext
    const results = getJsonResult<WriteFileResult>(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.error).toBeUndefined();
    expect(itemResult?.dryRun).toBe(false); // Added optional chaining

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalledWith(path.dirname(expectedPath), { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, expectedBuffer, expectedOptions);
    expect(mockAppendFile).not.toHaveBeenCalled();
  });
});