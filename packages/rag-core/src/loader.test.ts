import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import * as loader from '../src/loader.js'; // Use static import
import fs from 'node:fs/promises'; // Import fs to mock
import fg from 'fast-glob'; // Import fg to mock

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('fast-glob');

const mockReadFile = vi.mocked(fs.readFile);
const mockStat = vi.mocked(fs.stat);
const mockFg = vi.mocked(fg);

describe('Document Loader', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockReadFile.mockReset();
    mockStat.mockReset();
    mockFg.mockReset();
    // Disable console logging during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore console and other spies/mocks
  });

  // Keep tests focused on the exported function loadDocuments
  // Internal function getIgnorePatterns is tested implicitly via loadDocuments

  describe('loadDocuments', () => {
     const projectRoot = '/fake/project';
     const defaultIgnores = ['node_modules/**', '.git/**', 'dist/**'];

     it('should load documents correctly, applying default ignores when .gitignore is missing', async () => {
       // Mock readFile for .gitignore to simulate ENOENT
       const gitignoreError: any = new Error('ENOENT');
       gitignoreError.code = 'ENOENT';
       mockReadFile.mockImplementation(async (filePath) => {
           if (filePath === path.join(projectRoot, '.gitignore')) {
               throw gitignoreError;
           }
           // Handle other readFile calls for actual documents
           if (filePath === path.join(projectRoot, 'file1.ts')) return 'content1';
           if (filePath === path.join(projectRoot, 'subdir/file2.js')) return 'content2';
           throw new Error(`Unexpected readFile call: ${filePath}`);
       });

       // Mock fs operations for the files
       mockStat
         .mockResolvedValueOnce({ birthtimeMs: 1000, mtimeMs: 2000, size: 10 } as any) // Cast mock stat
         .mockResolvedValueOnce({ birthtimeMs: 1500, mtimeMs: 2500, size: 20 } as any); // Cast mock stat


       // Mock fast-glob response
      const files = ['file1.ts', 'subdir/file2.js'];
      mockFg.mockResolvedValue(files);

      const documents = await loader.loadDocuments(projectRoot); // Call static import

      // Check readFile was called for .gitignore
      expect(mockReadFile).toHaveBeenCalledWith(path.join(projectRoot, '.gitignore'), 'utf-8');
      // Check fg was called with default ignores
      expect(mockFg).toHaveBeenCalledWith('**/*', {
        cwd: projectRoot,
        dot: true,
        ignore: defaultIgnores, // Expecting default ignores
        absolute: false,
        onlyFiles: true,
      });
      expect(mockReadFile).toHaveBeenCalledWith(path.join(projectRoot, 'file1.ts'), 'utf-8');
      expect(mockReadFile).toHaveBeenCalledWith(path.join(projectRoot, 'subdir/file2.js'), 'utf-8');
      expect(mockStat).toHaveBeenCalledWith(path.join(projectRoot, 'file1.ts'));
      expect(mockStat).toHaveBeenCalledWith(path.join(projectRoot, 'subdir/file2.js'));

      expect(documents).toHaveLength(2);
      expect(documents[0]).toEqual({
        id: 'file1.ts',
        content: 'content1',
        metadata: { filePath: 'file1.ts', createdAt: 1000, lastModified: 2000, size: 10 },
      });
       expect(documents[1]).toEqual({
        id: 'subdir/file2.js',
        content: 'content2',
        metadata: { filePath: 'subdir/file2.js', createdAt: 1500, lastModified: 2500, size: 20 },
      });
    });

     it('should apply custom ignores from .gitignore', async () => {
      const gitignoreContent = 'subdir/**\n*.js';
      const combinedIgnores = [...defaultIgnores, 'subdir/**', '*.js'];
      // Mock readFile for .gitignore and the actual file
       mockReadFile.mockImplementation(async (filePath) => {
           if (filePath === path.join(projectRoot, '.gitignore')) return gitignoreContent;
           if (filePath === path.join(projectRoot, 'file1.ts')) return 'content1';
           throw new Error(`Unexpected readFile call: ${filePath}`);
       });

       // Mock fs operations for the remaining file
       mockStat.mockResolvedValueOnce({ birthtimeMs: 1000, mtimeMs: 2000, size: 10 } as any); // Cast mock stat


      const files = ['file1.ts']; // fast-glob should filter out subdir/file2.js
      mockFg.mockResolvedValue(files);

      const documents = await loader.loadDocuments(projectRoot); // Call static import

      // Check readFile was called for .gitignore
      expect(mockReadFile).toHaveBeenCalledWith(path.join(projectRoot, '.gitignore'), 'utf-8');
      expect(mockFg).toHaveBeenCalledWith('**/*', expect.objectContaining({ ignore: combinedIgnores }));
      expect(documents).toHaveLength(1);
      expect(documents[0].id).toBe('file1.ts');
    });

    it('should skip files with read errors', async () => {
      // Mock .gitignore read (success or failure doesn't matter here)
      // Mock fs operations, making readFile fail for bad.txt
      mockReadFile.mockImplementation(async (filePath) => {
          if (filePath === path.join(projectRoot, '.gitignore')) return ''; // Empty gitignore
          if (filePath === path.join(projectRoot, 'good.txt')) return 'good content';
          if (filePath === path.join(projectRoot, 'bad.txt')) throw new Error('Permission denied'); // Error for bad.txt
          throw new Error(`Unexpected readFile call: ${filePath}`);
      });

      // Mock fs operations, making readFile fail for bad.txt
      // Stat will only be called for good.txt
      mockStat.mockResolvedValueOnce({ birthtimeMs: 100, mtimeMs: 200, size: 5 } as any); // Cast mock stat


      const files = ['good.txt', 'bad.txt'];
      mockFg.mockResolvedValue(files);

      const documents = await loader.loadDocuments(projectRoot); // Call static import

      // Check readFile was called for .gitignore
      expect(mockReadFile).toHaveBeenCalledWith(path.join(projectRoot, '.gitignore'), 'utf-8');
      expect(mockFg).toHaveBeenCalledWith('**/*', expect.objectContaining({ ignore: defaultIgnores }));
      expect(documents).toHaveLength(1);
      expect(documents[0].id).toBe('good.txt');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('bad.txt'), expect.any(Error));
      // Ensure stat was not called for the bad file
      expect(mockStat).toHaveBeenCalledTimes(1);
      expect(mockStat).toHaveBeenCalledWith(path.join(projectRoot, 'good.txt'));
    });

    it('should handle empty file list from fast-glob', async () => {
        // Mock .gitignore read
        mockReadFile.mockImplementation(async (filePath) => {
            if (filePath === path.join(projectRoot, '.gitignore')) return '';
            throw new Error(`Unexpected readFile call: ${filePath}`);
        });
        mockFg.mockResolvedValue([]); // No files found

        const documents = await loader.loadDocuments(projectRoot); // Call static import
        expect(documents).toHaveLength(0);
        // Check readFile was called for .gitignore
        expect(mockReadFile).toHaveBeenCalledWith(path.join(projectRoot, '.gitignore'), 'utf-8');
        expect(mockFg).toHaveBeenCalledWith('**/*', expect.objectContaining({ ignore: defaultIgnores }));
        expect(mockReadFile).toHaveBeenCalledTimes(1); // Only .gitignore read
        expect(mockStat).not.toHaveBeenCalled();
    });
  });
});