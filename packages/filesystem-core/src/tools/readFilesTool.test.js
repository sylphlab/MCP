import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile, stat } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import { readFilesTool } from './readFilesTool';
// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
    stat: vi.fn(),
}));
const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root
// Helper to create mock Stats objects
const createMockStats = (isFile) => ({
    isFile: () => isFile,
    isDirectory: () => !isFile,
    // Add other properties if needed, or cast to Partial<Stats>
    dev: 0, ino: 0, mode: 0, nlink: 0, uid: 0, gid: 0, rdev: 0, size: 42, blksize: 4096, blocks: 1, atimeMs: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0, atime: new Date(), mtime: new Date(), ctime: new Date(), birthtime: new Date(),
});
describe('readFilesTool', () => {
    const mockReadFile = vi.mocked(readFile);
    const mockStat = vi.mocked(stat);
    beforeEach(() => {
        vi.resetAllMocks();
        // Default mocks
        mockStat.mockResolvedValue(createMockStats(true)); // Assume path exists and is file by default
        mockReadFile.mockResolvedValue(Buffer.from('')); // Default to empty buffer
    });
    const defaultOptions = { allowOutsideWorkspace: false };
    const allowOutsideOptions = { allowOutsideWorkspace: true };
    it('should read a single file with utf-8 encoding by default', async () => {
        const input = {
            paths: ['file.txt'],
            encoding: 'utf-8',
            includeStats: false,
            // allowOutsideWorkspace removed
        };
        const fileContent = 'Hello World!';
        mockReadFile.mockResolvedValue(Buffer.from(fileContent, 'utf-8'));
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.path).toBe('file.txt');
        expect(result.results[0]?.content).toBe(fileContent);
        expect(result.results[0]?.stat).toBeUndefined();
        expect(result.results[0]?.error).toBeUndefined();
        expect(mockReadFile).toHaveBeenCalledTimes(1);
        expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'));
        expect(mockStat).not.toHaveBeenCalled(); // Not called if includeStats is false
    });
    it('should read a single file with base64 encoding', async () => {
        const input = {
            paths: ['file.bin'],
            encoding: 'base64',
            includeStats: false,
            // allowOutsideWorkspace removed
        };
        const fileContent = 'SGVsbG8gV29ybGQh'; // "Hello World!" in base64
        const fileBuffer = Buffer.from(fileContent, 'base64');
        mockReadFile.mockResolvedValue(fileBuffer);
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.content).toBe(fileContent); // Should return base64 string
        expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
    it('should read multiple files', async () => {
        const input = {
            paths: ['file1.txt', 'file2.txt'],
            encoding: 'utf-8',
            includeStats: false,
            // allowOutsideWorkspace removed
        };
        mockReadFile
            .mockResolvedValueOnce(Buffer.from('Content 1'))
            .mockResolvedValueOnce(Buffer.from('Content 2'));
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(2);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.content).toBe('Content 1');
        expect(result.results[1]?.success).toBe(true);
        expect(result.results[1]?.content).toBe('Content 2');
        expect(mockReadFile).toHaveBeenCalledTimes(2);
    });
    it('should include stats when requested', async () => {
        const input = {
            paths: ['file.txt'],
            includeStats: true,
            encoding: 'utf-8',
            // allowOutsideWorkspace removed
        };
        const mockFileStats = createMockStats(true);
        mockStat.mockResolvedValue(mockFileStats); // Mock stat for the file
        mockReadFile.mockResolvedValue(Buffer.from('content'));
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.stat).toBeDefined();
        expect(result.results[0]?.stat?.size).toBe(42); // Check example stat value
        expect(mockStat).toHaveBeenCalledTimes(1); // Only called once when includeStats is true
        expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
    it('should fail if includeStats is true and path is not a file', async () => {
        const input = {
            paths: ['dir'],
            includeStats: true,
            encoding: 'utf-8',
            // allowOutsideWorkspace removed
        };
        mockStat.mockResolvedValue(createMockStats(false)); // Mock stat says it's a directory
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false); // Overall success is false as the only read failed
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('is not a file');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockStat).toHaveBeenCalledTimes(1);
        expect(mockReadFile).not.toHaveBeenCalled();
    });
    it('should return validation error for empty paths array', async () => {
        const input = { paths: [] }; // Invalid input
        // No options needed for input validation failure
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Input validation failed');
        expect(result.error).toContain('paths array cannot be empty');
        expect(mockReadFile).not.toHaveBeenCalled();
    });
    it('should handle path validation failure (outside workspace)', async () => {
        const input = { paths: ['../outside.txt'], encoding: 'utf-8', includeStats: false }; // allowOutsideWorkspace removed
        // Explicitly test with allowOutsideWorkspace: false
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('Path validation failed');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockReadFile).not.toHaveBeenCalled();
    });
    it('should handle non-existent file error (ENOENT)', async () => {
        const input = { paths: ['nonexistent.txt'], encoding: 'utf-8', includeStats: false }; // allowOutsideWorkspace removed
        const readError = new Error('ENOENT');
        readError.code = 'ENOENT';
        mockReadFile.mockRejectedValue(readError);
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('File not found');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
    it('should handle path is directory error (EISDIR)', async () => {
        const input = { paths: ['directory'], encoding: 'utf-8', includeStats: false }; // allowOutsideWorkspace removed
        const readError = new Error('EISDIR');
        readError.code = 'EISDIR';
        mockReadFile.mockRejectedValue(readError);
        // Need to mock stat to say it's a directory IF includeStats was true, but here it's false,
        // so the error comes directly from readFile
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('Path is a directory');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
    it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
        const input = { paths: ['../outside.txt'], encoding: 'utf-8', includeStats: false }; // allowOutsideWorkspace removed
        const fileContent = 'Outside!';
        mockReadFile.mockResolvedValue(Buffer.from(fileContent, 'utf-8'));
        // Mock stat to succeed if includeStats were true (though it's false here)
        mockStat.mockResolvedValue(createMockStats(true));
        // Act
        const result = await readFilesTool.execute(input, WORKSPACE_ROOT, allowOutsideOptions); // Pass flag via options
        // Assert
        expect(result.success).toBe(true); // Should succeed as validation is skipped
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.error).toBeUndefined();
        expect(result.results[0]?.content).toBe(fileContent);
        expect(mockReadFile).toHaveBeenCalledTimes(1);
        expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt')); // Check resolved path
    });
    // TODO: Add tests for stat error when includeStats is true
    // TODO: Add tests for multiple files where some succeed and some fail
    // TODO: Add tests for lineRange once implemented
});
