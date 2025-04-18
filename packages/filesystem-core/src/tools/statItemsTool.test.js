import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stat } from 'node:fs/promises'; // Use named import
import path from 'node:path';
import { statItemsTool } from './statItemsTool';
// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
    stat: vi.fn(),
}));
const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root
// Helper to create mock Stats objects
const createMockStats = (isFile) => ({
    isFile: () => isFile,
    isDirectory: () => !isFile,
    // Add other properties if needed, or cast to Partial<Stats>
    dev: 0, ino: 0, mode: 0, nlink: 0, uid: 0, gid: 0, rdev: 0, size: 99, blksize: 4096, blocks: 1, atimeMs: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0, atime: new Date(), mtime: new Date(), ctime: new Date(), birthtime: new Date(),
});
describe('statItemsTool', () => {
    const mockStat = vi.mocked(stat);
    beforeEach(() => {
        vi.resetAllMocks();
        // Default mock to success
        mockStat.mockResolvedValue(createMockStats(true));
    });
    const defaultOptions = { allowOutsideWorkspace: false };
    const allowOutsideOptions = { allowOutsideWorkspace: true };
    it('should successfully get stats for a single item', async () => {
        const input = { paths: ['file.txt'] };
        const mockStatsData = createMockStats(true);
        mockStat.mockResolvedValue(mockStatsData);
        const result = await statItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.path).toBe('file.txt');
        expect(result.results[0]?.stat).toEqual(mockStatsData);
        expect(result.results[0]?.error).toBeUndefined();
        expect(mockStat).toHaveBeenCalledTimes(1);
        expect(mockStat).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'));
    });
    it('should successfully get stats for multiple items', async () => {
        const input = { paths: ['file1.txt', 'dir/file2.png'] };
        const mockStats1 = createMockStats(true);
        const mockStats2 = createMockStats(true);
        mockStat
            .mockResolvedValueOnce(mockStats1)
            .mockResolvedValueOnce(mockStats2);
        const result = await statItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(2);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.stat).toEqual(mockStats1);
        expect(result.results[1]?.success).toBe(true);
        expect(result.results[1]?.stat).toEqual(mockStats2);
        expect(mockStat).toHaveBeenCalledTimes(2);
    });
    it('should handle non-existent path (ENOENT) gracefully', async () => {
        const input = { paths: ['nonexistent.txt'] };
        const enoentError = new Error('ENOENT');
        enoentError.code = 'ENOENT';
        mockStat.mockRejectedValue(enoentError);
        const result = await statItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false); // Overall success is false if any path not found
        expect(result.results).toHaveLength(1);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.stat).toBeUndefined();
        expect(result.results[0]?.error).toContain('Path \'nonexistent.txt\' not found');
        expect(mockStat).toHaveBeenCalledTimes(1);
    });
    it('should handle other stat errors', async () => {
        const input = { paths: ['no_access.txt'] };
        const accessError = new Error('EACCES');
        accessError.code = 'EACCES';
        mockStat.mockRejectedValue(accessError);
        const result = await statItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.stat).toBeUndefined();
        expect(result.results[0]?.error).toContain('Failed to get stats');
        expect(result.results[0]?.error).toContain('EACCES');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockStat).toHaveBeenCalledTimes(1);
    });
    it('should handle multiple items with mixed results (found and not found)', async () => {
        const input = { paths: ['found.txt', 'not_found.txt'] };
        const mockStatsFound = createMockStats(true);
        const enoentError = new Error('ENOENT');
        enoentError.code = 'ENOENT';
        mockStat
            .mockResolvedValueOnce(mockStatsFound)
            .mockRejectedValueOnce(enoentError);
        const result = await statItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true); // Overall success is true because one succeeded
        expect(result.results).toHaveLength(2);
        // First item (success)
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.stat).toEqual(mockStatsFound);
        expect(result.results[0]?.error).toBeUndefined();
        // Second item (not found)
        expect(result.results[1]?.success).toBe(false);
        expect(result.results[1]?.stat).toBeUndefined();
        expect(result.results[1]?.error).toContain('not found');
        expect(result.results[1]?.suggestion).toEqual(expect.any(String)); // Expect a suggestion for ENOENT
        expect(mockStat).toHaveBeenCalledTimes(2);
    });
    it('should return validation error for empty paths array', async () => {
        const input = { paths: [] }; // Invalid input
        // No options needed for input validation failure
        const result = await statItemsTool.execute(input, WORKSPACE_ROOT);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Input validation failed');
        expect(result.error).toContain('paths array cannot be empty');
        expect(mockStat).not.toHaveBeenCalled();
    });
    it('should handle path validation failure (outside workspace)', async () => {
        const input = { paths: ['../outside.txt'] };
        // Explicitly test with allowOutsideWorkspace: false
        const result = await statItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false); // Overall success is false
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('Path validation failed');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockStat).not.toHaveBeenCalled();
    });
    it('should allow stat outside workspace when allowOutsideWorkspace is true', async () => {
        const input = { paths: ['../outside.txt'] };
        const mockStatsData = createMockStats(true);
        mockStat.mockResolvedValue(mockStatsData);
        // Execute with allowOutsideWorkspace: true
        const result = await statItemsTool.execute(input, WORKSPACE_ROOT, allowOutsideOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.error).toBeUndefined();
        expect(result.results[0]?.stat).toEqual(mockStatsData);
        expect(mockStat).toHaveBeenCalledTimes(1);
        expect(mockStat).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'));
    });
}); // End of describe block
