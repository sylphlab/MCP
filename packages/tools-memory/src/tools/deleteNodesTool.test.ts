// packages/tools-memory/src/tools/deleteNodesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteNodesTool } from './deleteNodesTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node, Edge } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { deleteNodesToolOutputSchema } from './deleteNodesTool.schema.js'; // Assuming schema export

// Mock graphUtils
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockSaveGraph = vi.mocked(graphUtils.saveGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('deleteNodesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Nodes - Use UUIDs now
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Person'], properties: {} };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['City'], properties: {} };
  const node3: Node = { id: '33333333-3333-3333-3333-333333333333', labels: ['Person'], properties: {} };
  // Edges connecting nodes - Use UUIDs and add edge IDs
  const edge12: Edge = { id: 'e12', from: node1.id, to: node2.id, type: 'LIVES_IN', properties: {} };
  const edge21: Edge = { id: 'e21', from: node2.id, to: node1.id, type: 'CONTAINS', properties: {} };
  const edge13: Edge = { id: 'e13', from: node1.id, to: node3.id, type: 'KNOWS', properties: {} };
  const edge32: Edge = { id: 'e32', from: node3.id, to: node2.id, type: 'VISITED', properties: {} };


  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    // Deep clone initial graph state
    mockGraph = {
      nodes: [
        { ...node1 },
        { ...node2 },
        { ...node3 },
      ],
      edges: [
        { ...edge12 },
        { ...edge21 },
        { ...edge13 },
        { ...edge32 },
      ],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
    mockSaveGraph.mockResolvedValue(undefined);
  });

  it('should delete a single node and its connected edges', async () => {
    const idsToDelete = [node1.id]; // Use UUID
    const resultParts = await deleteNodesTool.execute({ context: mockContext, args: { nodeIds: idsToDelete } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.nodes.find(n => n.id === node1.id)).toBeUndefined();
    expect(savedGraph.nodes).toHaveLength(2);
    expect(savedGraph.edges.find(e => e.from === node1.id || e.to === node1.id)).toBeUndefined();
    expect(savedGraph.edges).toHaveLength(1);
    expect(savedGraph.edges[0].id).toBe('e32');

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([node1.id]);
    }
  });

  it('should delete multiple nodes and their connected edges', async () => {
    const idsToDelete = [node1.id, node2.id]; // Use UUIDs
    const resultParts = await deleteNodesTool.execute({ context: mockContext, args: { nodeIds: idsToDelete } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.nodes.find(n => n.id === node1.id)).toBeUndefined();
    expect(savedGraph.nodes.find(n => n.id === node2.id)).toBeUndefined();
    expect(savedGraph.nodes).toHaveLength(1);
    expect(savedGraph.edges).toHaveLength(0);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual(expect.arrayContaining([node1.id, node2.id]));
      expect(part.value).toHaveLength(2);
    }
  });

  it('should return empty array if attempting to delete non-existent nodes', async () => {
    const idsToDelete = ['44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'];
    const resultParts = await deleteNodesTool.execute({ context: mockContext, args: { nodeIds: idsToDelete } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([]);
    }
  });

  it('should delete existing nodes and ignore non-existent ones in the same request', async () => {
    const idsToDelete = [node1.id, '44444444-4444-4444-4444-444444444444'];
    const resultParts = await deleteNodesTool.execute({ context: mockContext, args: { nodeIds: idsToDelete } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.nodes.find(n => n.id === node1.id)).toBeUndefined();
    expect(savedGraph.nodes).toHaveLength(2);
    expect(savedGraph.edges.find(e => e.from === node1.id || e.to === node1.id)).toBeUndefined();
    expect(savedGraph.edges).toHaveLength(1);
    expect(savedGraph.edges[0].id).toBe('e32');

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([node1.id]);
    }
  });

  it('should handle deleting all nodes', async () => {
    const idsToDelete = [node1.id, node2.id, node3.id];
    const resultParts = await deleteNodesTool.execute({ context: mockContext, args: { nodeIds: idsToDelete } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.nodes).toHaveLength(0);
    expect(savedGraph.edges).toHaveLength(0);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual(expect.arrayContaining([node1.id, node2.id, node3.id]));
      expect(part.value).toHaveLength(3);
    }
  });


  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);

    // Corrected assertion
    await expect(deleteNodesTool.execute({ context: mockContext, args: { nodeIds: [node1.id] } })).rejects.toThrow();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);

    // Corrected assertion
    await expect(deleteNodesTool.execute({ context: mockContext, args: { nodeIds: [node1.id] } })).rejects.toThrow();
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion
    await expect(deleteNodesTool.execute({ context: mockContext, args: { nodeIds: [node1.id] } })).rejects.toThrow('Invalid path');
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});