// packages/tools-memory/src/tools/getNodeTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNodeTool } from './getNodeTool';
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types'; // Added Node
import { jsonPart, type JsonPart } from '@sylphlab/tools-core'; // Added JsonPart type
import { getNodeToolOutputSchema } from './getNodeTool.schema.js';

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('getNodeTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Person'], properties: { name: 'Alice', age: 30 } };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['City'], properties: { name: 'Berlin' } };


  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    mockGraph = {
      nodes: [
        { ...node1, properties: { ...node1.properties } }, // Deep clone properties too
        { ...node2, properties: { ...node2.properties } },
      ],
      edges: [],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
  });

  it('should return the correct node when found by ID', async () => {
    const resultParts = await getNodeTool.execute({ context: mockContext, args: { id: node1.id } }); // Use node1.id
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    // Type guard
    if (part.type === 'json') {
      expect(part.value).toEqual<Node>( // Explicit type assertion for clarity
         { ...node1, properties: { ...node1.properties } } // Expect a deep clone match
      );
    }
  });

  it('should return null when node ID does not exist', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const resultParts = await getNodeTool.execute({ context: mockContext, args: { id: nonExistentId } });
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    // Type guard
    if (part.type === 'json') {
      expect(part.value).toBeNull();
    }
  });

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);

    // Corrected assertion: Just check if it throws an error
    await expect(getNodeTool.execute({ context: mockContext, args: { id: node1.id } })).rejects.toThrow();
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
  });

  it('should return null if the graph is empty', async () => {
    mockLoadGraph.mockResolvedValue({ nodes: [], edges: [] });
    const resultParts = await getNodeTool.execute({ context: mockContext, args: { id: node1.id } });
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    // Type guard
    if (part.type === 'json') {
      expect(part.value).toBeNull();
    }
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion: Expect the original error
    await expect(getNodeTool.execute({ context: mockContext, args: { id: node1.id } })).rejects.toThrow('Invalid path');
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).not.toHaveBeenCalled();
  });
});