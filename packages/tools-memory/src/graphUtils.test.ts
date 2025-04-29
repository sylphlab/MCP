import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadGraph, saveGraph, resolveMemoryFilePath } from './graphUtils';
import type { KnowledgeGraph, Entity, Relation } from './types';

// Mock the fs/promises module
vi.mock('node:fs', async (importOriginal) => {
  const originalFs = await importOriginal<typeof import('node:fs')>();
  return {
    ...originalFs,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

// Type-safe mocked functions
const mockedFs = {
  readFile: vi.mocked(fs.readFile),
  writeFile: vi.mocked(fs.writeFile),
  mkdir: vi.mocked(fs.mkdir),
};

const testFilePath = '/fake/path/memory.json';
const testWorkspaceRoot = '/fake/path';

describe('graphUtils', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    // Spy on console methods to check warnings/errors
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console spies
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // --- resolveMemoryFilePath Tests ---
  describe('resolveMemoryFilePath', () => {
    it('should return the default path when no override is provided', () => {
      const expectedPath = path.join(testWorkspaceRoot, 'memory.json');
      expect(resolveMemoryFilePath(testWorkspaceRoot)).toBe(expectedPath);
    });

    it('should resolve a relative override path correctly', () => {
      const override = 'data/my_memory.json';
      const expectedPath = path.resolve(testWorkspaceRoot, override);
      expect(resolveMemoryFilePath(testWorkspaceRoot, override)).toBe(expectedPath);
    });

    it('should use an absolute override path directly if provided', () => {
      // On Windows, path.resolve treats a path starting with '/' as relative to the current drive.
      // To ensure it's treated as absolute, we might need a drive letter or use a different approach
      // depending on the exact behavior needed. For cross-platform testing, let's assume
      // path.resolve handles it correctly based on the OS.
      const override = path.resolve('/absolute/override/memory.json'); // Use path.resolve for consistency
      expect(resolveMemoryFilePath(testWorkspaceRoot, override)).toBe(override);
    });

     it('should resolve a relative override path with .. correctly', () => {
      const override = '../sibling_dir/memory.json';
      const expectedPath = path.resolve(testWorkspaceRoot, override);
      expect(resolveMemoryFilePath(testWorkspaceRoot, override)).toBe(expectedPath);
    });
  });

  // --- loadGraph Tests ---
  describe('loadGraph', () => {
    it('should return an empty graph if the file does not exist (ENOENT)', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockedFs.readFile.mockRejectedValue(error);

      const graph = await loadGraph(testFilePath);
      expect(graph).toEqual({ entities: [], relations: [] });
      expect(mockedFs.readFile).toHaveBeenCalledWith(testFilePath, 'utf-8');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return an empty graph if the file is empty', async () => {
      mockedFs.readFile.mockResolvedValue('');

      const graph = await loadGraph(testFilePath);
      expect(graph).toEqual({ entities: [], relations: [] });
      expect(mockedFs.readFile).toHaveBeenCalledWith(testFilePath, 'utf-8');
    });

     it('should return an empty graph if the file contains only whitespace', async () => {
      mockedFs.readFile.mockResolvedValue('   \n  \t \n ');

      const graph = await loadGraph(testFilePath);
      expect(graph).toEqual({ entities: [], relations: [] });
      expect(mockedFs.readFile).toHaveBeenCalledWith(testFilePath, 'utf-8');
    });

    it('should load entities and relations correctly from valid JSON lines', async () => {
      const entity1: Entity = { name: 'NodeA', entityType: 'Test', observations: ['obs1'] };
      const relation1: Relation = { from: 'NodeA', to: 'NodeB', relationType: 'connects' };
      const entity2: Entity = { name: 'NodeB', entityType: 'Test', observations: [] };
      const fileContent = [
        JSON.stringify({ type: 'entity', ...entity1 }),
        JSON.stringify({ type: 'relation', ...relation1 }),
        JSON.stringify({ type: 'entity', ...entity2 }),
      ].join('\n');

      mockedFs.readFile.mockResolvedValue(fileContent);

      const graph = await loadGraph(testFilePath);
      expect(graph).toEqual({
        entities: [
          { ...entity1, type: 'entity' },
          { ...entity2, type: 'entity' },
        ],
        relations: [{ ...relation1, type: 'relation' }],
      });
      expect(mockedFs.readFile).toHaveBeenCalledWith(testFilePath, 'utf-8');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should skip lines with invalid JSON and log a warning', async () => {
      const entity1: Entity = { name: 'NodeA', entityType: 'Test', observations: ['obs1'] };
      const fileContent = [
        JSON.stringify({ type: 'entity', ...entity1 }),
        'this is not json',
        '{"type": "relation", "from": "NodeA"}', // Missing 'to' and 'relationType'
        '{"name": "NodeC", "entityType": "Test", "observations": []}', // Missing 'type'
      ].join('\n');

      mockedFs.readFile.mockResolvedValue(fileContent);

      const graph = await loadGraph(testFilePath);
      expect(graph).toEqual({ entities: [{ ...entity1, type: 'entity' }], relations: [] });
      expect(mockedFs.readFile).toHaveBeenCalledWith(testFilePath, 'utf-8');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // For the JSON.parse error
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error parsing line 2'), expect.any(Error));
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2); // For the two invalid structure lines
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid line 3'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid line 4'));
    });

     it('should skip lines with invalid entity/relation structure and log a warning', async () => {
      const entity1: Entity = { name: 'NodeA', entityType: 'Test', observations: ['obs1'] };
      const fileContent = [
        JSON.stringify({ type: 'entity', ...entity1 }),
        JSON.stringify({ type: 'entity', name: 'NodeB' }), // Missing entityType, observations
        JSON.stringify({ type: 'relation', from: 'NodeA', to: 'NodeC' }), // Missing relationType
        JSON.stringify({ name: 'NodeD', entityType: 'Test', observations: [] }), // Missing type field
      ].join('\n');

      mockedFs.readFile.mockResolvedValue(fileContent);

      const graph = await loadGraph(testFilePath);
      expect(graph).toEqual({ entities: [{ ...entity1, type: 'entity' }], relations: [] });
      expect(mockedFs.readFile).toHaveBeenCalledWith(testFilePath, 'utf-8');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid line 2'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid line 3'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid line 4'));
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw an error if readFile fails with an error other than ENOENT', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      mockedFs.readFile.mockRejectedValue(error);

      await expect(loadGraph(testFilePath)).rejects.toThrow('Permission denied');
      expect(mockedFs.readFile).toHaveBeenCalledWith(testFilePath, 'utf-8');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading knowledge graph'), error);
    });
  });

  // --- saveGraph Tests ---
  describe('saveGraph', () => {
    const entity1: Entity = { name: 'NodeA', entityType: 'Test', observations: ['obs1'] };
    const relation1: Relation = { from: 'NodeA', to: 'NodeB', relationType: 'connects' };
    const entity2: Entity = { name: 'NodeB', entityType: 'Test', observations: [] };
    const validGraph: KnowledgeGraph = {
      entities: [entity1, entity2],
      relations: [relation1],
    };

    it('should ensure the directory exists', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined); // Successfully created or already exists
      mockedFs.writeFile.mockResolvedValue(undefined);

      await saveGraph(testFilePath, validGraph);

      const expectedDir = path.dirname(testFilePath);
      expect(mockedFs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
    });

     it('should ignore EEXIST error when creating directory', async () => {
      const error = new Error('Dir exists') as NodeJS.ErrnoException;
      error.code = 'EEXIST';
      mockedFs.mkdir.mockRejectedValue(error);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await expect(saveGraph(testFilePath, validGraph)).resolves.toBeUndefined();
      const expectedDir = path.dirname(testFilePath);
      expect(mockedFs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(consoleErrorSpy).not.toHaveBeenCalled(); // Should not log EEXIST
    });

    it('should throw error if mkdir fails with error other than EEXIST', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      mockedFs.mkdir.mockRejectedValue(error);

      await expect(saveGraph(testFilePath, validGraph)).rejects.toThrow('Permission denied');
      const expectedDir = path.dirname(testFilePath);
      expect(mockedFs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error creating directory'), error);
    });

    it('should write the graph entities and relations to the file', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await saveGraph(testFilePath, validGraph);

      const expectedContent = [
        JSON.stringify({ type: 'entity', ...entity1 }),
        JSON.stringify({ type: 'entity', ...entity2 }),
        JSON.stringify({ type: 'relation', ...relation1 }),
      ].join('\n');

      expect(mockedFs.writeFile).toHaveBeenCalledWith(testFilePath, expectedContent);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should filter out invalid entities and relations before saving', async () => {
       mockedFs.mkdir.mockResolvedValue(undefined);
       mockedFs.writeFile.mockResolvedValue(undefined);

       const invalidEntity: any = { name: 'Invalid' }; // Missing type and observations
       const invalidRelation: any = { from: 'A' }; // Missing to and type
       const graphWithInvalid: KnowledgeGraph = {
         entities: [entity1, invalidEntity, entity2],
         relations: [invalidRelation, relation1],
       };

       await saveGraph(testFilePath, graphWithInvalid);

       const expectedContent = [
         JSON.stringify({ type: 'entity', ...entity1 }),
         JSON.stringify({ type: 'entity', ...entity2 }),
         JSON.stringify({ type: 'relation', ...relation1 }),
       ].join('\n');

       expect(mockedFs.writeFile).toHaveBeenCalledWith(testFilePath, expectedContent);
       // Optionally check console for warnings about filtering if that was implemented
    });

    it('should handle an empty graph correctly', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      const emptyGraph: KnowledgeGraph = { entities: [], relations: [] };

      await saveGraph(testFilePath, emptyGraph);

      expect(mockedFs.writeFile).toHaveBeenCalledWith(testFilePath, ''); // Empty string for empty graph
    });

    it('should throw an error if writeFile fails', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      const error = new Error('Disk full') as NodeJS.ErrnoException;
      error.code = 'ENOSPC';
      mockedFs.writeFile.mockRejectedValue(error);

      await expect(saveGraph(testFilePath, validGraph)).rejects.toThrow('Disk full');
      expect(mockedFs.writeFile).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error saving knowledge graph'), error);
    });
  });
});