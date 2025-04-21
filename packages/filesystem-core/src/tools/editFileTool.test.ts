import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises'; // Use named imports
import path from 'node:path';
import { editFileTool, type EditFileToolInput, type EditOperation } from './editFileTool';
import type { McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type

// Mock the specific fs/promises functions we need
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace'; // Define a consistent mock workspace root

describe('editFileTool', () => {
  const mockReadFile = readFile as MockedFunction<typeof readFile>;
  const mockWriteFile = writeFile as MockedFunction<typeof writeFile>;

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock implementations
    mockReadFile.mockResolvedValue(''); // Default to empty file
    mockWriteFile.mockResolvedValue(undefined); // Default to successful write
  });

  // Helper function to create input easily
  const createInput = (changes: { path: string; edits: EditOperation[] }[]): EditFileToolInput => ({ changes });

  // Define options objects including workspaceRoot
  const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false };
  const allowOutsideOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: true };

  it('should insert content at the specified line', async () => {
    const initialContent = 'line1\nline3';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'insert', start_line: 2, content: 'line2' }],
    }]);
    const expectedContent = 'line1\nline2\nline3';

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object
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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object
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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.edit_results[0]?.success).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
  });

  it('should fail delete_lines if end_line is out of bounds', async () => {
    const initialContent = 'line1\nline2';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'delete_lines', start_line: 1, end_line: 3 }], // end_line 3 is out of bounds
    }]);

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.edit_results[0]?.success).toBe(false);
    expect(result.results[0]?.edit_results[0]?.error).toContain('end_line 3 is out of bounds (1-2)');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should fail delete_lines if end_line < start_line', async () => {
    const initialContent = 'line1\nline2\nline3';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'delete_lines', start_line: 3, end_line: 1 }],
    }]);

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    // Expect early failure due to Zod validation
    expect(result.results).toEqual([]);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('end_line must be greater than or equal to start_line');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });


  it('should replace specified lines', async () => {
    const initialContent = 'line1\nline2\nline3\nline4';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'replace_lines', start_line: 2, end_line: 3, content: 'new_line_A\nnew_line_B' }],
    }]);
    const expectedContent = 'line1\nnew_line_A\nnew_line_B\nline4';

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.edit_results[0]?.success).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
  });

  it('should fail replace_lines if end_line is out of bounds', async () => {
    const initialContent = 'line1\nline2';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'replace_lines', start_line: 1, end_line: 3, content: 'new' }], // end_line 3 is out of bounds
    }]);

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.edit_results[0]?.success).toBe(false);
    expect(result.results[0]?.edit_results[0]?.error).toContain('end_line 3 is out of bounds (1-2)');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should fail replace_lines if end_line < start_line', async () => {
    const initialContent = 'line1\nline2\nline3';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'replace_lines', start_line: 3, end_line: 1, content: 'new' }],
    }]);

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    // Expect early failure due to Zod validation
    expect(result.results).toEqual([]);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('end_line must be greater than or equal to start_line');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });


  it('should perform search and replace (text)', async () => {
    const initialContent = 'hello world\nhello again\nworld';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'search_replace_text', search: 'hello', replace: 'hi' }],
    }]);
    const expectedContent = 'hi world\nhi again\nworld';

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.edit_results[0]?.message).toContain('1 replacement(s)');
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
  });

  it('should fail search_replace if end_line is out of bounds', async () => {
    const initialContent = 'apple\nbanana';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'search_replace_text', search: 'a', replace: 'b', start_line: 1, end_line: 3 }], // end_line 3 out of bounds
    }]);

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.edit_results[0]?.success).toBe(false);
    expect(result.results[0]?.edit_results[0]?.error).toContain('end_line 3 is out of bounds (1-2)');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should fail search_replace if end_line < start_line', async () => {
    const initialContent = 'apple\nbanana\ncherry';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'search_replace_text', search: 'a', replace: 'b', start_line: 3, end_line: 1 }],
    }]);

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    // Expect early failure due to Zod validation
    expect(result.results).toEqual([]);
    expect(result.error).toContain('Input validation failed');
    expect(result.error).toContain('end_line must be greater than or equal to start_line');
    expect(mockWriteFile).not.toHaveBeenCalled();
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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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

    const result = await editFileTool.execute(input as any, { workspaceRoot: WORKSPACE_ROOT }); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.edit_results[0]?.success).toBe(true);
    expect(result.results[0]?.edit_results[0]?.message).toBe('No replacements needed between lines 1 and 1.'); // Match exact message
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should handle invalid regex pattern', async () => {
    const initialContent = 'line1';
    mockReadFile.mockResolvedValue(initialContent);
    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'search_replace_regex', regex: '(', replace: 'fail' }], // Invalid regex
    }]);

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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
    const expectedContent = 'new line'; // Code now writes without trailing newline for single line insert

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), expectedContent, 'utf-8');
  });

  it('should fail path validation if path is outside workspace and allowOutsideWorkspace is false', async () => {
    const input = createInput([{
      path: '../outside.txt',
      edits: [{ operation: 'insert', start_line: 1, content: 'test' }],
    }]);

    const result = await editFileTool.execute(input, { workspaceRoot: WORKSPACE_ROOT, allowOutsideWorkspace: false }); // Pass options object

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
    const result = await editFileTool.execute(input, allowOutsideOptions); // Pass options object

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

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(true);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.edit_results[0]?.success).toBe(true);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });


  it('should perform search/replace text with start_line omitted', async () => {
    const filePath = 'file.txt';
    const initialContent = 'line1\nline2 foo\nline3 foo';
    const expectedContent = 'line1\nline2 bar\nline3 bar';
    mockWriteFile.mockClear(); // Use correct mock variable
    mockReadFile.mockResolvedValue(initialContent); // Use correct mock variable

    const input: EditFileToolInput = {
      changes: [
        {
          path: filePath,
          edits: [
            {
              operation: 'search_replace_text',
              search: 'foo',
              replace: 'bar',
              // start_line omitted - should default to 1
            },
          ],
        },
      ],
    };

    const output = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.message).toContain('2 replacement(s)');
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8'); // Use correct mock variable
  });

  it('should perform search/replace text with end_line omitted', async () => {
    const filePath = 'file.txt';
    const initialContent = 'line1 foo\nline2 foo\nline3';
    const expectedContent = 'line1 bar\nline2 bar\nline3';
    mockWriteFile.mockClear(); // Use correct mock variable
    mockReadFile.mockResolvedValue(initialContent); // Use correct mock variable

    const input: EditFileToolInput = {
      changes: [
        {
          path: filePath,
          edits: [
            {
              operation: 'search_replace_text',
              search: 'foo',
              replace: 'bar',
              start_line: 1,
              // end_line omitted - should default to end of file
            },
          ],
        },
      ],
    };

    const output = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.message).toContain('2 replacement(s)');
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8'); // Use correct mock variable
  });

  it('should perform search/replace regex with flags omitted', async () => {
    const filePath = 'file.txt';
    const initialContent = 'line1 FOO\nline2 foo\nline3 FOO';
    // Without 'g' flag, only replaces first instance on each line
    // Without 'i' flag, case-sensitive
    const expectedContent = 'line1 FOO\nline2 bar\nline3 FOO';
    mockWriteFile.mockClear(); // Use correct mock variable
    mockReadFile.mockResolvedValue(initialContent); // Use correct mock variable

    const input: EditFileToolInput = {
      changes: [
        {
          path: filePath,
          edits: [
            {
              operation: 'search_replace_regex',
              regex: 'foo',
              replace: 'bar',
              // flags omitted
            },
          ],
        },
      ],
    };

    const output = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.message).toContain('1 replacement(s)'); // Only replaces 'foo' on line 2
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8'); // Use correct mock variable
  });


  it('should handle generic errors during edit processing', async () => {
    const initialContent = 'line1';
    mockReadFile.mockResolvedValue(initialContent);
    const genericError = new Error('Something unexpected happened');
    // Mock the first edit operation itself to throw a generic error
    // This requires modifying the input or mocking deeper, let's mock readFile instead
    mockReadFile.mockRejectedValueOnce(genericError);

    const input = createInput([{
      path: 'file.txt',
      edits: [{ operation: 'insert', start_line: 1, content: 'test' }]
    }]);

    const result = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(false);
    expect(result.results[0]?.error).toContain(genericError.message);
    // Check the suggestion from the outer catch block (line 332 in source)
    expect(result.results[0]?.edit_results[0]?.suggestion).toBe('Check if file \'file.txt\' exists and if you have read/write permissions.');
  });



  it('should perform search/replace text with start_line omitted', async () => {
    const filePath = 'file.txt';
    const initialContent = 'line1\nline2 foo\nline3 foo';
    const expectedContent = 'line1\nline2 bar\nline3 bar';
    mockWriteFile.mockClear(); // Use correct mock variable
    mockReadFile.mockResolvedValue(initialContent); // Use correct mock variable

    const input: EditFileToolInput = {
      changes: [
        {
          path: filePath,
          edits: [
            {
              operation: 'search_replace_text',
              search: 'foo',
              replace: 'bar',
              // start_line omitted - should default to 1
            },
          ],
        },
      ],
    };

    const output = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.message).toContain('2 replacement(s)');
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8'); // Use correct mock variable
  });

  it('should perform search/replace text with end_line omitted', async () => {
    const filePath = 'file.txt';
    const initialContent = 'line1 foo\nline2 foo\nline3';
    const expectedContent = 'line1 bar\nline2 bar\nline3';
    mockWriteFile.mockClear(); // Use correct mock variable
    mockReadFile.mockResolvedValue(initialContent); // Use correct mock variable

    const input: EditFileToolInput = {
      changes: [
        {
          path: filePath,
          edits: [
            {
              operation: 'search_replace_text',
              search: 'foo',
              replace: 'bar',
              start_line: 1,
              // end_line omitted - should default to end of file
            },
          ],
        },
      ],
    };

    const output = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.message).toContain('2 replacement(s)');
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8'); // Use correct mock variable
  });

  it('should perform search/replace regex with flags omitted', async () => {
    const filePath = 'file.txt';
    const initialContent = 'line1 FOO\nline2 foo\nline3 FOO';
    // Without 'g' flag, only replaces first instance on each line
    // Without 'i' flag, case-sensitive
    const expectedContent = 'line1 FOO\nline2 bar\nline3 FOO';
    mockWriteFile.mockClear(); // Use correct mock variable
    mockReadFile.mockResolvedValue(initialContent); // Use correct mock variable

    const input: EditFileToolInput = {
      changes: [
        {
          path: filePath,
          edits: [
            {
              operation: 'search_replace_regex',
              regex: 'foo',
              replace: 'bar',
              // flags omitted
            },
          ],
        },
      ],
    };

    const output = await editFileTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.success).toBe(true);
    expect(output.results[0]?.edit_results[0]?.message).toContain('1 replacement(s)'); // Only replaces 'foo' on line 2
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, filePath), expectedContent, 'utf-8'); // Use correct mock variable
  });


});
