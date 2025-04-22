import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core'; // Import Part
import DiffMatchPatch from 'diff-match-patch'; // Import DMP
import { type MockedFunction, beforeEach, describe, expect, it, vi } from 'vitest';
import { type EditFileToolInput, editFileTool } from './editFileTool.js';
import type { EditResult, FileEditResult } from './editFileTool.js'; // Import correct result types

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

const WORKSPACE_ROOT = '/test/workspace';
const defaultOptions: McpToolExecuteOptions = { workspaceRoot: WORKSPACE_ROOT };
// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  const jsonPart = parts.find(part => part.type === 'json');
  if (jsonPart && jsonPart.value !== undefined) {
    try {
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  return undefined;
}
  return undefined;
}

// Helper to calculate hash
const calculateHash = (content: string) => createHash('sha256').update(content).digest('hex');

describe('editFileTool', () => {
  const mockReadFile = readFile as MockedFunction<typeof readFile>;
  const mockWriteFile = writeFile as MockedFunction<typeof writeFile>;
  const dmp = new DiffMatchPatch();

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    mockReadFile.mockResolvedValue(Buffer.from('Initial content'));
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('should apply a valid patch successfully', async () => {
    const originalContent = 'Line 1\nLine 2\nLine 3';
    const newContent = 'Line 1\nLine Two\nLine 3';
    const patchText = dmp.patch_toText(dmp.patch_make(originalContent, newContent));
    const originalHash = calculateHash(originalContent);
    const newHash = calculateHash(newContent);

    mockReadFile.mockResolvedValue(Buffer.from(originalContent));

    const input: EditFileToolInput = {
      changes: [
        {
          path: 'file.txt',
          expectedHash: originalHash,
          edits: [{ operation: 'apply_diff_patch', patch: patchText }],
        },
      ],
      dryRun: false,
    };

    const parts = await editFileTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const fileResult = results?.[0];

    expect(fileResult.success).toBe(true);
    expect(fileResult.path).toBe('file.txt');
    expect(fileResult.dryRun).toBe(false);
    expect(fileResult.oldHash).toBe(originalHash);
    expect(fileResult.newHash).toBe(newHash);
    expect(fileResult.error).toBeUndefined();
    expect(fileResult.edit_results).toHaveLength(1);
    expect(fileResult.edit_results[0].success).toBe(true);
    expect(fileResult.edit_results[0].message).toContain('Patch applied successfully');

    expect(mockReadFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'));
    expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(WORKSPACE_ROOT, 'file.txt'), Buffer.from(newContent));
  });

   it('should perform a dry run successfully', async () => {
    const originalContent = 'Line 1\nLine 2\nLine 3';
    const newContent = 'Line 1\nLine Two\nLine 3';
    const patchText = dmp.patch_toText(dmp.patch_make(originalContent, newContent));
    const originalHash = calculateHash(originalContent);
    const newHash = calculateHash(newContent);

    mockReadFile.mockResolvedValue(Buffer.from(originalContent));

    const input: EditFileToolInput = {
      changes: [
        {
          path: 'file.txt',
          expectedHash: originalHash,
          edits: [{ operation: 'apply_diff_patch', patch: patchText }],
        },
      ],
      dryRun: true, // Explicit dry run
    };

    const parts = await editFileTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const fileResult = results?.[0];

    expect(fileResult.success).toBe(true); // Dry run simulation is success
    expect(fileResult.path).toBe('file.txt');
    expect(fileResult.dryRun).toBe(true);
    expect(fileResult.oldHash).toBe(originalHash);
    expect(fileResult.newHash).toBe(newHash); // New hash is calculated even in dry run
    expect(fileResult.error).toBeUndefined();
    expect(fileResult.edit_results).toHaveLength(1);
    expect(fileResult.edit_results[0].success).toBe(true);
    expect(fileResult.edit_results[0].message).toContain('[Dry Run]');
    expect(fileResult.edit_results[0].message).toContain('Patch would be applied');

    expect(mockReadFile).toHaveBeenCalledOnce();
    expect(mockWriteFile).not.toHaveBeenCalled(); // Write should not happen
  });

  it('should report no changes if patch results in same content', async () => {
    const originalContent = 'Line 1\nLine 2\nLine 3';
    const patchText = dmp.patch_toText(dmp.patch_make(originalContent, originalContent)); // Patch to same content
    const originalHash = calculateHash(originalContent);

    mockReadFile.mockResolvedValue(Buffer.from(originalContent));

    const input: EditFileToolInput = {
      changes: [ { path: 'file.txt', edits: [{ operation: 'apply_diff_patch', patch: patchText }] } ],
      dryRun: false,
    };

    const parts = await editFileTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const fileResult = results?.[0];

    expect(fileResult.success).toBe(true);
    expect(fileResult.oldHash).toBe(originalHash);
    expect(fileResult.newHash).toBe(originalHash); // Hash should be the same
    expect(fileResult.edit_results[0].success).toBe(true);
    expect(fileResult.edit_results[0].message).toContain('resulted in no changes');

    expect(mockWriteFile).not.toHaveBeenCalled(); // No write if no change
  });


  it('should fail if expectedHash does not match', async () => {
    const originalContent = 'Line 1';
    const wrongHash = 'wronghash123';
    const patchText = dmp.patch_toText(dmp.patch_make(originalContent, 'Line One'));

    mockReadFile.mockResolvedValue(Buffer.from(originalContent));

    const input: EditFileToolInput = {
      changes: [
        {
          path: 'file.txt',
          expectedHash: wrongHash, // Provide wrong hash
          edits: [{ operation: 'apply_diff_patch', patch: patchText }],
        },
      ],
    };

    const parts = await editFileTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const fileResult = results?.[0];

    expect(fileResult.success).toBe(false);
    expect(fileResult.error).toContain('File hash mismatch');
    expect(fileResult.suggestion).toContain('File content has changed');
    expect(fileResult.edit_results).toHaveLength(1); // Edit result should still be present, showing failure
    expect(fileResult.edit_results[0].success).toBe(false);
    expect(fileResult.edit_results[0].error).toContain('File hash mismatch');

    expect(mockReadFile).toHaveBeenCalledOnce();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should fail if patch text is invalid', async () => {
     const originalContent = 'Line 1';
     const invalidPatchText = '@@ invalid patch @@';
     mockReadFile.mockResolvedValue(Buffer.from(originalContent));

     const input: EditFileToolInput = {
       changes: [ { path: 'file.txt', edits: [{ operation: 'apply_diff_patch', patch: invalidPatchText }] } ],
     };

     const parts = await editFileTool.execute(input, defaultOptions);
     const results = getJsonResult(parts);

     expect(results).toBeDefined();
     expect(results).toHaveLength(1);
     const fileResult = results?.[0];

     expect(fileResult.success).toBe(false);
     expect(fileResult.error).toBeUndefined(); // File level error is undefined
     expect(fileResult.edit_results).toHaveLength(1);
     expect(fileResult.edit_results[0].success).toBe(false);
     expect(fileResult.edit_results[0].error).toContain('Failed to parse patch text');
     expect(fileResult.edit_results[0].suggestion).toContain('Check patch content');

     expect(mockReadFile).toHaveBeenCalledOnce();
     expect(mockWriteFile).not.toHaveBeenCalled();
   });

   it('should fail if patch does not apply cleanly', async () => {
     const originalContent = 'Line 1\nLine 2\nLine 3';
     // Create a patch based on different content
     const patchText = dmp.patch_toText(dmp.patch_make('Line A\nLine B\nLine C', 'Line A\nLine Two\nLine C'));
     mockReadFile.mockResolvedValue(Buffer.from(originalContent)); // Provide original content

     const input: EditFileToolInput = {
       changes: [ { path: 'file.txt', edits: [{ operation: 'apply_diff_patch', patch: patchText }] } ],
     };

     const parts = await editFileTool.execute(input, defaultOptions);
     const results = getJsonResult(parts);

     expect(results).toBeDefined();
     expect(results).toHaveLength(1);
     const fileResult = results?.[0];

     expect(fileResult.success).toBe(false);
     expect(fileResult.error).toBeUndefined();
     expect(fileResult.edit_results).toHaveLength(1);
     expect(fileResult.edit_results[0].success).toBe(false);
     expect(fileResult.edit_results[0].error).toContain('Patch application failed');
     expect(fileResult.edit_results[0].suggestion).toContain('patch could not be applied cleanly');

     expect(mockReadFile).toHaveBeenCalledOnce();
     expect(mockWriteFile).not.toHaveBeenCalled();
   });


  it('should handle readFile error', async () => {
    const readError = new Error('Permission denied');
    (readError as NodeJS.ErrnoException).code = 'EACCES';
    mockReadFile.mockRejectedValue(readError);
    const patchText = dmp.patch_toText(dmp.patch_make('a', 'b'));

    const input: EditFileToolInput = {
      changes: [ { path: 'file.txt', edits: [{ operation: 'apply_diff_patch', patch: patchText }] } ],
    };

    const parts = await editFileTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const fileResult = results?.[0];

    expect(fileResult.success).toBe(false);
    expect(fileResult.error).toContain('Permission denied');
    expect(fileResult.suggestion).toContain('read/write permissions');
    expect(fileResult.edit_results).toHaveLength(1); // Edit result shows failure due to read error
    expect(fileResult.edit_results[0].success).toBe(false);
    expect(fileResult.edit_results[0].error).toContain('File processing failed before edit');

    expect(mockReadFile).toHaveBeenCalledOnce();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

   it('should handle writeFile error', async () => {
    const originalContent = 'Line 1';
    const newContent = 'Line One';
    const patchText = dmp.patch_toText(dmp.patch_make(originalContent, newContent));
    const writeError = new Error('Disk full');
    (writeError as NodeJS.ErrnoException).code = 'ENOSPC';

    mockReadFile.mockResolvedValue(Buffer.from(originalContent));
    mockWriteFile.mockRejectedValue(writeError); // Mock writeFile failure

    const input: EditFileToolInput = {
      changes: [ { path: 'file.txt', edits: [{ operation: 'apply_diff_patch', patch: patchText }] } ],
      dryRun: false,
    };

    // Execute should still resolve, but the result object indicates failure
    const parts = await editFileTool.execute(input, defaultOptions);
    const results = getJsonResult(parts);


    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const fileResult = results?.[0];

    // File processing itself failed at the write stage, even if patch applied conceptually
    expect(fileResult.success).toBe(false);
    expect(fileResult.error).toContain('Disk full'); // Error from writeFile
    expect(fileResult.suggestion).toContain('read/write permissions'); // Suggestion from generic file processing catch
    expect(fileResult.edit_results).toHaveLength(1);
    expect(fileResult.edit_results[0].success).toBe(true); // Patch application itself succeeded

    expect(mockReadFile).toHaveBeenCalledOnce();
    expect(mockWriteFile).toHaveBeenCalledOnce();
  });

  it('should fail path validation if path is outside workspace', async () => {
    const patchText = dmp.patch_toText(dmp.patch_make('a', 'b'));
    const input: EditFileToolInput = {
      changes: [ { path: '../outside.txt', edits: [{ operation: 'apply_diff_patch', patch: patchText }] } ],
    };

    const parts = await editFileTool.execute(input, defaultOptions); // allowOutsideWorkspace defaults to false
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const fileResult = results?.[0];

    expect(fileResult.success).toBe(false);
    expect(fileResult.error).toContain('Path validation failed');
    expect(fileResult.suggestion).toContain('outside workspace');
    expect(fileResult.edit_results).toHaveLength(0); // No edits attempted

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should succeed editing outside workspace when allowed', async () => {
     const originalContent = 'Outside content';
     const newContent = 'New outside content';
     const patchText = dmp.patch_toText(dmp.patch_make(originalContent, newContent));
     const resolvedPath = path.resolve(WORKSPACE_ROOT, '../outside.txt');

     mockReadFile.mockResolvedValue(Buffer.from(originalContent));
     mockWriteFile.mockResolvedValue(undefined);

     const input: EditFileToolInput = {
       changes: [ { path: '../outside.txt', edits: [{ operation: 'apply_diff_patch', patch: patchText }] } ],
       dryRun: false,
     };

     const parts = await editFileTool.execute(input, { ...defaultOptions, allowOutsideWorkspace: true });
     const results = getJsonResult(parts);

     expect(results).toBeDefined();
     expect(results).toHaveLength(1);
     const fileResult = results?.[0];

     expect(fileResult.success).toBe(true);
     expect(fileResult.error).toBeUndefined();
     expect(fileResult.edit_results[0].success).toBe(true);

     expect(mockReadFile).toHaveBeenCalledWith(resolvedPath);
     expect(mockWriteFile).toHaveBeenCalledWith(resolvedPath, Buffer.from(newContent));
   });

});