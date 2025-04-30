// packages/tools-memory/src/tools/findNodesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findNodesTool } from './findNodesTool';
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { findNodesToolOutputSchema } from './findNodesTool.schema.js';

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('findNodesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Use UUIDs for IDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Person', 'User'], properties: { name: 'Alice Smith', age: 30, city: 'London' } };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['City'], properties: { name: 'Berlin', country: 'Germany' } };
  const node3: Node = { id: '33333333-3333-3333-3333-333333333333', labels: ['Person'], properties: { name: 'Bob Johnson', age: 25, city: 'Paris' } };
  const node4: Node = { id: '44444444-4444-4444-4444-444444444444', labels: ['User'], properties: { name: 'Charlie', city: 'London', email: 'charlie@example.com' } };
  const node5: Node = { id: '55555555-5555-5555-5555-555555555555', labels: ['Company'], properties: { name: 'Acme Corp', industry: 'Tech', city: 'London' } };


  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    mockGraph = {
      nodes: [node1, node2, node3, node4, node5],
      edges: [],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
  });

  // --- Basic Query Tests ---
  it('should find nodes by name property (substring, default)', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'lice', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([node1]);
      expect(part.value.totalCount).toBe(1);
    }
  });
  it('should find nodes by name property (exact)', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'Alice Smith', search_in: 'name', mode: 'exact', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([node1]);
      expect(part.value.totalCount).toBe(1);
    }
  });
  it('should not find nodes by name property (exact) with partial match', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'Alice', search_in: 'name', mode: 'exact', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([]);
      expect(part.value.totalCount).toBe(0);
    }
  });


  // --- Search In Tests ---

  it('should find nodes by label (substring)', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'ers', search_in: 'labels', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      // CORRECTED Assertion: query 'ers' should only match 'Person' (node1, node3)
      expect(part.value.nodes).toHaveLength(2); // Expect 2 nodes
      const receivedIds = part.value.nodes.map((n: Node) => n.id).sort();
      const expectedIds = [node1.id, node3.id].sort(); // Expect node1 and node3
      expect(receivedIds).toEqual(expectedIds);
      expect(part.value.totalCount).toBe(2); // Expect total count 2
    }
  });

  it('should find nodes by label (exact)', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'User', search_in: 'labels', mode: 'exact', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(2);
      const receivedIds = part.value.nodes.map((n: Node) => n.id).sort();
      const expectedIds = [node1.id, node4.id].sort();
      expect(receivedIds).toEqual(expectedIds);
      expect(part.value.totalCount).toBe(2);
    }
  });

  it('should find nodes by property value (substring)', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'ondon', search_in: 'properties', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(3);
      const receivedIds = part.value.nodes.map((n: Node) => n.id).sort();
      const expectedIds = [node1.id, node4.id, node5.id].sort();
      expect(receivedIds).toEqual(expectedIds);
      expect(part.value.totalCount).toBe(3);
    }
  });

   it('should find nodes by property value (exact)', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'London', search_in: 'properties', mode: 'exact', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(3);
      const receivedIds = part.value.nodes.map((n: Node) => n.id).sort();
      const expectedIds = [node1.id, node4.id, node5.id].sort();
      expect(receivedIds).toEqual(expectedIds);
      expect(part.value.totalCount).toBe(3);
    }
  });

  it('should find nodes searching "all" (substring, default)', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'Corp', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([node5]);
      expect(part.value.totalCount).toBe(1);
    }
  });

  it('should find nodes searching "all" (exact)', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'User', mode: 'exact', limit: 50, offset: 0 } });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(2);
      const receivedIds = part.value.nodes.map((n: Node) => n.id).sort();
      const expectedIds = [node1.id, node4.id].sort();
      expect(receivedIds).toEqual(expectedIds);
      expect(part.value.totalCount).toBe(2);
    }
  });

  // --- Limit and Offset Tests ---
  it('should limit the number of results', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'o', limit: 2, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(4);
    }
  });
  it('should apply offset to the results', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'o', limit: 2, offset: 2 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(4);
    }
  });
  it('should handle offset exceeding total results', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'o', limit: 2, offset: 10 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([]);
      expect(part.value.totalCount).toBe(4);
    }
  });


  // --- No Results and Edge Cases ---
   it('should return empty array if query does not match anything', async () => {
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'NonExistentXYZ', limit: 50, offset: 0 } });
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
    const resultParts = await findNodesTool.execute({ context: mockContext, args: { query: 'Alice', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([]);
      expect(part.value.totalCount).toBe(0);
    }
  });


  // --- Error Handling ---

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);
    await expect(findNodesTool.execute({ context: mockContext, args: { query: 'Alice', limit: 50, offset: 0 } }))
          .rejects.toThrow('Failed to find nodes: Failed to load graph'); // Check exact message
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });
    await expect(findNodesTool.execute({ context: mockContext, args: { query: 'Alice', limit: 50, offset: 0 } }))
          .rejects.toThrow('Invalid path'); // Expect original error
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).not.toHaveBeenCalled();
  });
});