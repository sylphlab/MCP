// packages/tools-memory/src/tools/listNodesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listNodesTool } from './listNodesTool';
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { listNodesToolOutputSchema } from './listNodesTool.schema.js';

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('listNodesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Sample nodes - Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Person', 'User'], properties: { name: 'Alice', age: 30, city: 'London' } };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['City'], properties: { name: 'Berlin', country: 'Germany' } };
  const node3: Node = { id: '33333333-3333-3333-3333-333333333333', labels: ['Person'], properties: { name: 'Bob', age: 25, city: 'Paris' } };
  const node4: Node = { id: '44444444-4444-4444-4444-444444444444', labels: ['User'], properties: { name: 'Charlie', city: 'London' } };
  const node5: Node = { id: '55555555-5555-5555-5555-555555555555', labels: ['City'], properties: { name: 'London', country: 'UK' } };


  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    mockGraph = {
      nodes: [node1, node2, node3, node4, node5], // Use the defined nodes
      edges: [],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
  });

  it('should list all nodes with default limit/offset when no entity_type is provided', async () => {
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual(expect.arrayContaining([node1, node2, node3, node4, node5]));
      expect(part.value.nodes).toHaveLength(5);
      expect(part.value.totalCount).toBe(5);
    }
  });

  it('should filter nodes by entity_type (label)', async () => {
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { entity_type: 'City', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual(expect.arrayContaining([node2, node5]));
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(2);
    }
  });

  it('should filter nodes by another entity_type (label)', async () => {
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { entity_type: 'Person', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual(expect.arrayContaining([node1, node3]));
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(2);
    }
  });

   it('should filter nodes by a label shared by multiple nodes', async () => {
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { entity_type: 'User', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual(expect.arrayContaining([node1, node4]));
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(2);
    }
  });

  it('should limit the number of results when listing all nodes', async () => {
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { limit: 2, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.nodes).toEqual([node1, node2]); // Assuming order
      expect(part.value.totalCount).toBe(5);
    }
  });

  it('should apply offset when listing all nodes', async () => {
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { limit: 2, offset: 3 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([node4, node5]); // Assuming order
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(5);
    }
  });

  it('should apply limit and offset with entity_type filter', async () => {
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { entity_type: 'City', limit: 1, offset: 1 } });
     expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([node5]); // Assuming n2, n5 order
      expect(part.value.nodes).toHaveLength(1);
      expect(part.value.totalCount).toBe(2);
    }
  });


  it('should return empty array if no nodes match entity_type filter', async () => {
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { entity_type: 'NonExistent', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([]);
      expect(part.value.totalCount).toBe(0);
    }
  });

  it('should return empty array if the graph is empty', async () => {
    mockLoadGraph.mockResolvedValue({ nodes: [], edges: [] });
    const resultParts = await listNodesTool.execute({ context: mockContext, args: { limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([]);
      expect(part.value.totalCount).toBe(0);
    }
  });

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);

    // Corrected assertion: Just check if it throws
    await expect(listNodesTool.execute({ context: mockContext, args: { limit: 50, offset: 0 } })).rejects.toThrow();
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion: Expect original error
    await expect(listNodesTool.execute({ context: mockContext, args: { limit: 50, offset: 0 } })).rejects.toThrow('Invalid path');
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).not.toHaveBeenCalled();
  });
});