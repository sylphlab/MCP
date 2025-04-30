import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadGraph, saveGraph, resolveMemoryFilePath } from './graphUtils';
// Import NEW types and schemas
import type { KnowledgeGraph, Node, Edge } from './types';
import { KnowledgeGraphSchema } from './types'; // Import schema for saveGraph validation test

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

const testFilePath = '/fake/path/memory.jsonl';
const testWorkspaceRoot = '/fake/path';

describe('graphUtils', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  // Define test data using new Node/Edge structure with UUIDs
  const nodeA: Node = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', labels: ['Test', 'TypeA'], properties: { name: 'NodeA', value: 1 } };
  const nodeB: Node = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', labels: ['Test'], properties: { name: 'NodeB' } };
  const edge1: Edge = { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', type: 'CONNECTS', from: nodeA.id, to: nodeB.id, properties: { weight: 10 } };

  beforeEach(() => {
    vi.resetAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // --- resolveMemoryFilePath Tests (No change needed) ---
  describe('resolveMemoryFilePath', () => {
    // ... (tests remain the same) ...
    it('should return the default path when no override is provided', () => {
      const expectedPath = path.join(testWorkspaceRoot, 'memory.jsonl');
      expect(resolveMemoryFilePath(testWorkspaceRoot)).toBe(expectedPath);
    });

    it('should resolve a relative override path correctly', () => {
      const override = 'data/my_memory.jsonl';
      const expectedPath = path.resolve(testWorkspaceRoot, override);
      expect(resolveMemoryFilePath(testWorkspaceRoot, override)).toBe(expectedPath);
    });

    it('should use an absolute override path directly if provided', () => {
      const override = path.resolve('/absolute/override/memory.jsonl');
      expect(resolveMemoryFilePath(testWorkspaceRoot, override)).toBe(override);
    });

     it('should resolve a relative override path with .. correctly', () => {
      const override = '../sibling_dir/memory.jsonl';
      const expectedPath = path.resolve(testWorkspaceRoot, override);
      expect(resolveMemoryFilePath(testWorkspaceRoot, override)).toBe(expectedPath);
    });
  });

  // --- loadGraph Tests (Updated for Node/Edge) ---
  describe('loadGraph', () => {
    // ... (passing tests remain the same) ...
    it('should return an empty graph if the file does not exist (ENOENT)', async () => {
        const error = new Error('File not found') as NodeJS.ErrnoException; error.code = 'ENOENT';
        mockedFs.readFile.mockRejectedValue(error);
        const graph = await loadGraph(testFilePath);
        expect(graph).toEqual({ nodes: [], edges: [] });
    });
    it('should return an empty graph if the file is empty', async () => {
        mockedFs.readFile.mockResolvedValue('');
        const graph = await loadGraph(testFilePath);
        expect(graph).toEqual({ nodes: [], edges: [] });
    });
     it('should return an empty graph if the file contains only whitespace', async () => {
        mockedFs.readFile.mockResolvedValue('   \n  \t \n ');
        const graph = await loadGraph(testFilePath);
        expect(graph).toEqual({ nodes: [], edges: [] });
    });
    it('should load nodes and edges correctly from valid JSON lines', async () => {
        const fileContent = [ JSON.stringify(nodeA), JSON.stringify(edge1), JSON.stringify(nodeB) ].join('\n');
        mockedFs.readFile.mockResolvedValue(fileContent);
        const graph = await loadGraph(testFilePath);
        expect(graph).toEqual({ nodes: [nodeA, nodeB], edges: [edge1] });
    });

    it('should skip lines with invalid JSON and log an error', async () => {
      const invalidJsonLine = 'this is not json';
      const invalidStructureLine = JSON.stringify({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', labels: ['Invalid'] }); // Missing properties
      const fileContent = [
        JSON.stringify(nodeA),
        invalidJsonLine,
        invalidStructureLine,
      ].join('\n');

      mockedFs.readFile.mockResolvedValue(fileContent);

      const graph = await loadGraph(testFilePath);
      expect(graph).toEqual({ nodes: [nodeA], edges: [] });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error parsing line 2'), expect.any(SyntaxError));
      // Corrected: Only check call count for warn
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

     it('should skip lines with invalid node/edge structure (Zod validation) and log a warning', async () => {
       const invalidNode1 = { id: 'bad-uuid', labels: ['Test'], properties: {} }; // Invalid UUID
       const invalidEdge = { type: 'CONNECTS', from: nodeA.id, to: 'bad-uuid' }; // Invalid 'to' UUID
       const invalidNode2 = { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', properties: {} }; // Missing labels
       const fileContent = [
         JSON.stringify(nodeA),
         JSON.stringify(invalidNode1),
         JSON.stringify(invalidEdge),
         JSON.stringify(invalidNode2),
       ].join('\n');

       mockedFs.readFile.mockResolvedValue(fileContent);

       const graph = await loadGraph(testFilePath);
       expect(graph).toEqual({ nodes: [nodeA], edges: [] });
       // Corrected: Only check call count for warn
       expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
       expect(consoleErrorSpy).not.toHaveBeenCalled();
     });

    it('should throw an error if readFile fails with an error other than ENOENT', async () => {
        const error = new Error('Permission denied') as NodeJS.ErrnoException; error.code = 'EACCES';
        mockedFs.readFile.mockRejectedValue(error);
        await expect(loadGraph(testFilePath)).rejects.toThrow('Permission denied');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading knowledge graph'), error);
    });
  });

  // --- saveGraph Tests (Updated for Node/Edge) ---
  describe('saveGraph', () => {
    const validGraph: KnowledgeGraph = {
      nodes: [nodeA, nodeB],
      edges: [edge1],
    };

    // ... (passing tests remain the same) ...
    it('should ensure the directory exists', async () => {
        mockedFs.mkdir.mockResolvedValue(undefined); mockedFs.writeFile.mockResolvedValue(undefined);
        await saveGraph(testFilePath, validGraph);
        const expectedDir = path.dirname(testFilePath);
        expect(mockedFs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
    });
    it('should ignore EEXIST error when creating directory', async () => {
        const error = new Error('Dir exists') as NodeJS.ErrnoException; error.code = 'EEXIST';
        mockedFs.mkdir.mockRejectedValue(error); mockedFs.writeFile.mockResolvedValue(undefined);
        await expect(saveGraph(testFilePath, validGraph)).resolves.toBeUndefined();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
    it('should throw error if mkdir fails with error other than EEXIST', async () => {
        const error = new Error('Permission denied') as NodeJS.ErrnoException; error.code = 'EACCES';
        mockedFs.mkdir.mockRejectedValue(error);
        await expect(saveGraph(testFilePath, validGraph)).rejects.toThrow('Permission denied');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error creating directory'), error);
    });
    it('should write the graph nodes and edges to the file', async () => {
        mockedFs.mkdir.mockResolvedValue(undefined); mockedFs.writeFile.mockResolvedValue(undefined);
        await saveGraph(testFilePath, validGraph);
        const expectedContent = [ JSON.stringify(nodeA), JSON.stringify(nodeB), JSON.stringify(edge1) ].join('\n');
        expect(mockedFs.writeFile).toHaveBeenCalledWith(testFilePath, expectedContent);
    });

    it('should throw an error if the graph structure is invalid (Zod validation)', async () => {
       mockedFs.mkdir.mockResolvedValue(undefined);
       const invalidNode: any = { id: 'invalid-id', labels: [], properties: {} }; // Invalid ID
       const graphWithInvalid: KnowledgeGraph = {
         nodes: [nodeA, invalidNode],
         edges: [edge1],
       };

       await expect(saveGraph(testFilePath, graphWithInvalid)).rejects.toThrow("Invalid graph structure provided to saveGraph.");
       expect(mockedFs.writeFile).not.toHaveBeenCalled();
       expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid graph structure, cannot save:'), expect.any(Array));
    });


    it('should handle an empty graph correctly', async () => {
        mockedFs.mkdir.mockResolvedValue(undefined); mockedFs.writeFile.mockResolvedValue(undefined);
        const emptyGraph: KnowledgeGraph = { nodes: [], edges: [] };
        await saveGraph(testFilePath, emptyGraph);
        expect(mockedFs.writeFile).toHaveBeenCalledWith(testFilePath, '');
    });

    it('should throw an error if writeFile fails', async () => {
        mockedFs.mkdir.mockResolvedValue(undefined);
        const error = new Error('Disk full') as NodeJS.ErrnoException; error.code = 'ENOSPC';
        mockedFs.writeFile.mockRejectedValue(error);
        await expect(saveGraph(testFilePath, validGraph)).rejects.toThrow('Disk full');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error saving knowledge graph'), error);
    });
  });
});