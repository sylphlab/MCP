// packages/tools-memory/src/tools/listLabelsTool.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'; // Added afterEach
import { listLabelsTool } from './listLabelsTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { listLabelsToolOutputSchema } from './listLabelsTool.schema.js'; // Assuming schema export

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('listLabelsTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>; // Declare spy variable
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>; // Declare spy variable

  // Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Person', 'User'], properties: {} };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['City'], properties: {} };
  const node3: Node = { id: '33333333-3333-3333-3333-333333333333', labels: ['Person'], properties: {} }; // Duplicate 'Person'
  const node4: Node = { id: '44444444-4444-4444-4444-444444444444', labels: ['User', 'Admin'], properties: {} }; // Multiple labels, new 'Admin'
  const node5: Node = { id: '55555555-5555-5555-5555-555555555555', labels: ['City'], properties: {} }; // Duplicate 'City'
  const node6: Node = { id: '66666666-6666-6666-6666-666666666666', labels: [], properties: {} }; // No labels


  beforeEach(() => {
    vi.resetAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Initialize spy
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Initialize spy

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    mockGraph = {
      nodes: [node1, node2, node3, node4, node5, node6],
      edges: [],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
  });

   afterEach(() => { // Added afterEach
      consoleWarnSpy.mockRestore(); // Restore spy
      consoleErrorSpy.mockRestore(); // Restore spy
  });

  it('should list all unique labels present in the graph', async () => {
    const resultParts = await listLabelsTool.execute({ context: mockContext, args: {} });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual(expect.arrayContaining(['Person', 'User', 'City', 'Admin']));
      expect(part.value).toHaveLength(4);
    }
  });

  it('should return an empty array if the graph has no nodes', async () => {
    mockLoadGraph.mockResolvedValue({ nodes: [], edges: [] });
    const resultParts = await listLabelsTool.execute({ context: mockContext, args: {} });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([]);
    }
  });

  it('should return an empty array if no nodes have labels', async () => {
    mockGraph = { nodes: [node6], edges: [] };
    mockLoadGraph.mockResolvedValue(mockGraph);
    const resultParts = await listLabelsTool.execute({ context: mockContext, args: {} });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([]);
    }
  });


  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);

    // Corrected assertion: Check exact error message
    await expect(listLabelsTool.execute({ context: mockContext, args: {} }))
          .rejects.toThrow('Failed to list labels: Failed to load graph');
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion: Expect original error
    await expect(listLabelsTool.execute({ context: mockContext, args: {} }))
          .rejects.toThrow('Invalid path');
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).not.toHaveBeenCalled();
  });
});