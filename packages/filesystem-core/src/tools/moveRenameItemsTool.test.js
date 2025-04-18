import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rename, mkdir, rm, stat } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import { moveRenameItemsTool } from './moveRenameItemsTool';
// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
    rename: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
}));
const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root
// Helper to create mock Stats objects
const createMockStats = (isDirectory, isFile) => ({
    isFile: () => isFile,
    isDirectory: () => isDirectory,
    // Add other properties if needed, or cast to Partial<Stats>
    dev: 0, ino: 0, mode: 0, nlink: 0, uid: 0, gid: 0, rdev: 0, size: 123, blksize: 4096, blocks: 1, atimeMs: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0, atime: new Date(), mtime: new Date(), ctime: new Date(), birthtime: new Date(),
});
describe('moveRenameItemsTool', () => {
    const mockRename = vi.mocked(rename);
    const mockMkdir = vi.mocked(mkdir);
    const mockRm = vi.mocked(rm);
    const mockStat = vi.mocked(stat);
    beforeEach(() => {
        vi.resetAllMocks();
        // Default mocks
        mockRename.mockResolvedValue(undefined);
        mockMkdir.mockResolvedValue(undefined); // Assume mkdir succeeds
        mockRm.mockResolvedValue(undefined);
        // Default stat to ENOENT (file not found)
        const enoentError = new Error('ENOENT');
        enoentError.code = 'ENOENT';
        mockStat.mockRejectedValue(enoentError);
    });
    const defaultOptions = { allowOutsideWorkspace: false };
    const allowOutsideOptions = { allowOutsideWorkspace: true };
    it('should successfully move/rename item when destination does not exist', async () => {
        const input = {
            items: [{ sourcePath: 'old.txt', destinationPath: 'new.txt' }],
            overwrite: false,
            // allowOutsideWorkspace removed
        };
        // stat will reject with ENOENT (default mock)
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(mockMkdir).toHaveBeenCalledTimes(1); // Ensure parent dir creation called
        expect(mockStat).toHaveBeenCalledTimes(1); // Check destination existence
        expect(mockRm).not.toHaveBeenCalled(); // Should not remove if not exists
        expect(mockRename).toHaveBeenCalledTimes(1);
        expect(mockRename).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'old.txt'), path.resolve(WORKSPACE_ROOT, 'new.txt'));
    });
    it('should successfully move/rename with overwrite: true when destination exists', async () => {
        const input = {
            items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
            overwrite: true,
            // allowOutsideWorkspace removed
        };
        // Mock stat to indicate destination exists
        mockStat.mockResolvedValue(createMockStats(false, true));
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(mockMkdir).toHaveBeenCalledTimes(1);
        expect(mockStat).toHaveBeenCalledTimes(1); // Check destination existence
        expect(mockRm).toHaveBeenCalledTimes(1); // Should remove existing destination
        expect(mockRm).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'existing.txt'), { recursive: true, force: true });
        expect(mockRename).toHaveBeenCalledTimes(1);
        expect(mockRename).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'old.txt'), path.resolve(WORKSPACE_ROOT, 'existing.txt'));
    });
    it('should fail move/rename when destination exists and overwrite: false', async () => {
        const input = {
            items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
            overwrite: false,
            // allowOutsideWorkspace removed
        };
        // Mock stat to indicate destination exists
        mockStat.mockResolvedValue(createMockStats(false, true));
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('already exists and overwrite is false');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockMkdir).toHaveBeenCalledTimes(1);
        expect(mockStat).toHaveBeenCalledTimes(1); // Check destination existence
        expect(mockRm).not.toHaveBeenCalled(); // Should NOT remove
        expect(mockRename).not.toHaveBeenCalled(); // Should NOT rename
    });
    it('should return validation error for empty items array', async () => {
        const input = { items: [] }; // Invalid input
        // No options needed for input validation failure
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Input validation failed');
        expect(result.error).toContain('items array cannot be empty');
        expect(mockRename).not.toHaveBeenCalled();
    });
    it('should handle path validation failure (outside workspace)', async () => {
        const input = {
            items: [{ sourcePath: 'valid.txt', destinationPath: '../outside.txt' }],
            overwrite: false,
            // allowOutsideWorkspace removed
        };
        // Explicitly test with allowOutsideWorkspace: false
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('Path validation failed');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockRename).not.toHaveBeenCalled();
    });
    it('should handle source does not exist error (from rename)', async () => {
        const input = {
            items: [{ sourcePath: 'nonexistent.txt', destinationPath: 'new.txt' }],
            overwrite: false,
            // allowOutsideWorkspace removed
        };
        const renameError = new Error('ENOENT');
        renameError.code = 'ENOENT';
        mockRename.mockRejectedValue(renameError);
        // stat will reject with ENOENT (default mock) for destination
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('ENOENT');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockRename).toHaveBeenCalledTimes(1);
    });
    it('should handle mkdir error', async () => {
        const input = {
            items: [{ sourcePath: 'old.txt', destinationPath: 'new_dir/new.txt' }],
            overwrite: false,
            // allowOutsideWorkspace removed
        };
        const mkdirError = new Error('EACCES');
        mockMkdir.mockRejectedValue(mkdirError);
        // stat will reject with ENOENT (default mock) for destination
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('EACCES');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockMkdir).toHaveBeenCalledTimes(1);
        expect(mockRename).not.toHaveBeenCalled();
    });
    it('should handle rm error during overwrite', async () => {
        const input = {
            items: [{ sourcePath: 'old.txt', destinationPath: 'existing.txt' }],
            overwrite: true,
            // allowOutsideWorkspace removed
        };
        mockStat.mockResolvedValue(createMockStats(false, true)); // Destination exists
        const rmError = new Error('EPERM');
        mockRm.mockRejectedValue(rmError); // Mock rm failure
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('EPERM');
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockRm).toHaveBeenCalledTimes(1);
        expect(mockRename).not.toHaveBeenCalled();
    });
    it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
        const input = {
            items: [{ sourcePath: 'valid.txt', destinationPath: '../outside.txt' }],
            overwrite: false,
            // allowOutsideWorkspace removed
        };
        // stat will reject with ENOENT (default mock) for destination
        mockRename.mockResolvedValue(undefined); // Mock success
        // Act
        const result = await moveRenameItemsTool.execute(input, WORKSPACE_ROOT, allowOutsideOptions); // Pass flag via options
        // Assert
        expect(result.success).toBe(true); // Should succeed as validation is skipped
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.error).toBeUndefined();
        expect(mockMkdir).toHaveBeenCalledTimes(1); // Dest dir check
        expect(mockStat).toHaveBeenCalledTimes(1); // Dest existence check
        expect(mockRm).not.toHaveBeenCalled();
        expect(mockRename).toHaveBeenCalledTimes(1);
        expect(mockRename).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'valid.txt'), path.resolve(WORKSPACE_ROOT, '../outside.txt') // Check resolved path
        );
    });
    // TODO: Add tests for multiple items (success/fail mix)
    // TODO: Add tests for moving directories vs files
});
