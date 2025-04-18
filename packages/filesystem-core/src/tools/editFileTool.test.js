import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import { editFileTool } from './editFileTool';
// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
}));
const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root
describe('editFileTool', () => {
    const mockReadFile = readFile;
    const mockWriteFile = writeFile;
    beforeEach(() => {
        vi.resetAllMocks();
        // Default mock implementations
        mockReadFile.mockResolvedValue(''); // Default to empty file
        mockWriteFile.mockResolvedValue(undefined); // Default to successful write
    });
    // Helper function to create input easily
    // Use 'as any' to bypass strict type checking for the helper, as allowOutsideWorkspace is optional
    const createInput = (changes) => ({ changes });
    const defaultOptions = { allowOutsideWorkspace: false };
    const allowOutsideOptions = { allowOutsideWorkspace: true };
    it('should insert content at the specified line', async () => {
        const initialContent = 'line1\nline3';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'insert', start_line: 2, content: 'line2' }],
            }]);
        const expectedContent = 'line1\nline2\nline3';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledTimes(1);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should insert content at the beginning', async () => {
        const initialContent = 'line1\nline2';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'insert', start_line: 1, content: 'line0' }],
            }]);
        const expectedContent = 'line0\nline1\nline2';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should insert content at the end', async () => {
        const initialContent = 'line1\nline2';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'insert', start_line: 3, content: 'line3' }], // Line 3 means after line 2
            }]);
        const expectedContent = 'line1\nline2\nline3';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should delete specified lines', async () => {
        const initialContent = 'line1\nline2\nline3\nline4';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'delete_lines', start_line: 2, end_line: 3 }],
            }]);
        const expectedContent = 'line1\nline4';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should replace specified lines', async () => {
        const initialContent = 'line1\nline2\nline3\nline4';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'replace_lines', start_line: 2, end_line: 3, content: 'new_line_A\nnew_line_B' }],
            }]);
        const expectedContent = 'line1\nnew_line_A\nnew_line_B\nline4';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should perform search and replace (text)', async () => {
        const initialContent = 'hello world\nhello again\nworld';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'search_replace_text', search: 'hello', replace: 'hi' }],
            }]);
        const expectedContent = 'hi world\nhi again\nworld';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.message).toContain('2 replacement(s)');
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should perform search and replace (regex)', async () => {
        const initialContent = 'line 1\nline 2\nline 3';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'search_replace_regex', regex: '^line (\\d)', replace: 'L$1:', flags: 'gm' }],
            }]);
        const expectedContent = 'L1:\nL2:\nL3:';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.message).toContain('3 replacement(s)');
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should perform search and replace within line range', async () => {
        const initialContent = 'apple\nbanana\napple\ncherry';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'search_replace_text', search: 'apple', replace: 'orange', start_line: 2, end_line: 3 }],
            }]);
        const expectedContent = 'apple\nbanana\norange\ncherry';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.message).toContain('1 replacement(s)');
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should handle multiple edits on one file', async () => {
        const initialContent = 'line A\nline C';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [
                    { operation: 'insert', start_line: 2, content: 'line B' },
                    { operation: 'search_replace_text', search: 'line', replace: 'LINE' },
                ],
            }]);
        const expectedContent = 'LINE A\nLINE B\nLINE C';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results).toHaveLength(2);
        expect(result.results[0]?.edit_results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[1]?.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should handle edits across multiple files', async () => {
        mockReadFile
            .mockResolvedValueOnce('file1 content')
            .mockResolvedValueOnce('file2 content');
        const input = createInput([
            { path: 'file1.txt', edits: [{ operation: 'insert', start_line: 1, content: 'start' }] },
            { path: 'file2.txt', edits: [{ operation: 'delete_lines', start_line: 1, end_line: 1 }] },
        ]);
        const expectedContent1 = 'start\nfile1 content';
        const expectedContent2 = '';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(2);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[1]?.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledTimes(2);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file1.txt'), expectedContent1, 'utf-8');
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file2.txt'), expectedContent2, 'utf-8');
    });
    it('should return validation error for invalid input', async () => {
        const input = { changes: [{ path: 'file.txt', edits: [{ operation: 'insert' }] }] }; // Missing content/start_line
        const result = await editFileTool.execute(input, WORKSPACE_ROOT); // No options needed
        expect(result.success).toBe(false);
        expect(result.error).toContain('Input validation failed');
        expect(mockReadFile).not.toHaveBeenCalled();
        expect(mockWriteFile).not.toHaveBeenCalled();
    });
    it('should handle file read error', async () => {
        const readError = new Error('Cannot read file');
        mockReadFile.mockRejectedValue(readError);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'insert', start_line: 1, content: 'test' }],
            }]);
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('Cannot read file');
        expect(result.results[0]?.edit_results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockWriteFile).not.toHaveBeenCalled();
    });
    it('should handle edit error (e.g., invalid line number)', async () => {
        const initialContent = 'line1';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'insert', start_line: 5, content: 'test' }], // Line 5 out of bounds
            }]);
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.edit_results[0]?.success).toBe(false);
        expect(result.results[0]?.edit_results[0]?.error).toContain('start_line 5 is out of bounds');
        expect(result.results[0]?.edit_results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockWriteFile).not.toHaveBeenCalled();
    });
    it('should not write file if search/replace makes no changes', async () => {
        const initialContent = 'no change needed';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'search_replace_text', search: 'missing', replace: 'found' }],
            }]);
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.message).toContain('0 replacement(s)');
        expect(mockWriteFile).not.toHaveBeenCalled();
    });
    it('should handle invalid regex pattern', async () => {
        const initialContent = 'line1';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'search_replace_regex', regex: '(', replace: 'fail' }], // Invalid regex
            }]);
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.edit_results[0]?.success).toBe(false);
        expect(result.results[0]?.edit_results[0]?.error).toContain('Invalid regex pattern');
        expect(result.results[0]?.edit_results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockWriteFile).not.toHaveBeenCalled();
    });
    it('should insert into an empty file at line 1', async () => {
        const initialContent = '';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'insert', start_line: 1, content: 'new line' }],
            }]);
        const expectedContent = 'new line\n';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should delete the only line in a file', async () => {
        const initialContent = 'only line';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'delete_lines', start_line: 1, end_line: 1 }],
            }]);
        const expectedContent = '';
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, defaultOptions);
        expect(result.success).toBe(true);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
    });
    it('should fail path validation if path is outside workspace and allowOutsideWorkspace is false', async () => {
        const input = createInput([{
                path: '../outside.txt',
                edits: [{ operation: 'insert', start_line: 1, content: 'test' }],
            }]);
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, { allowOutsideWorkspace: false });
        expect(result.success).toBe(false);
        expect(result.results[0]?.success).toBe(false);
        expect(result.results[0]?.error).toContain('Path validation failed');
        // Suggestion is added to the file result for path validation failure
        expect(result.results[0]?.suggestion).toEqual(expect.any(String));
        expect(mockReadFile).not.toHaveBeenCalled();
        expect(mockWriteFile).not.toHaveBeenCalled();
    });
    it('should NOT fail path validation if path is outside workspace and allowOutsideWorkspace is true', async () => {
        const initialContent = 'outside content';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: '../outside.txt',
                edits: [{ operation: 'insert', start_line: 1, content: 'test' }],
            }]);
        const expectedContent = 'test\noutside content';
        // Act
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, { allowOutsideWorkspace: true }); // Pass flag
        // Assert
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.error).toBeUndefined();
        expect(mockReadFile).toHaveBeenCalledTimes(1);
        expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'), 'utf-8');
        expect(mockWriteFile).toHaveBeenCalledTimes(1);
        expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, '../outside.txt'), expectedContent, 'utf-8');
    });
    it('should not write file if replace operation makes no change', async () => {
        const initialContent = 'line1\nline2';
        mockReadFile.mockResolvedValue(initialContent);
        const input = createInput([{
                path: 'file.txt',
                edits: [{ operation: 'replace_lines', start_line: 1, end_line: 1, content: 'line1' }], // Replace line1 with line1
            }]);
        const result = await editFileTool.execute(input, WORKSPACE_ROOT, { allowOutsideWorkspace: false });
        expect(result.success).toBe(true);
        expect(result.results[0]?.success).toBe(true);
        expect(result.results[0]?.edit_results[0]?.success).toBe(true);
        expect(mockWriteFile).not.toHaveBeenCalled();
    });
});
