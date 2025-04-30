// packages/tools-memory/src/tools/deleteEdgesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteEdgesTool } from './deleteEdgesTool';
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node, Edge } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { deleteEdgesToolOutputSchema } from './deleteEdgesTool.schema.js';

// Mock graphUtils
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockSaveGraph = vi.mocked(graphUtils.saveGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('deleteEdgesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Nodes - Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: [], properties: {} };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: [], properties: {} };
  const node3: Node = { id: '33333333-3333-3333-3333-333333333333', labels: [], properties: {} };
  // Edges - Use UUIDs
  const edge1: Edge = { id: 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', from: node1.id, to: node2.id, type: 'REL_A', properties: {} };
  const edge2: Edge = { id: 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', from: node2.id, to: node3.id, type: 'REL_B', properties: {} };
  const edge3: Edge = { id: 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', from: node1.id, to: node3.id, type: 'REL_C', properties: {} };
  const edge4_duplicate: Edge = { id: 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', from: node1.id, to: node2.id, type: 'REL_A', properties: { extra: true } };


  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    // Deep clone initial graph state
    mockGraph = {
      nodes: [{ ...node1 }, { ...node2 }, { ...node3 }],
      edges: [{ ...edge1 }, { ...edge2 }, { ...edge3 }, { ...edge4_duplicate }],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
    mockSaveGraph.mockResolvedValue(undefined);
  });

  it('should delete a single edge identified by type, from, and to', async () => {
    const edgeIdentifier = { type: edge2.type, from: edge2.from, to: edge2.to };
    const resultParts = await deleteEdgesTool.execute({ context: mockContext, args: { edges: [edgeIdentifier] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.edges.find(e => e.id === edge2.id)).toBeUndefined();
    expect(savedGraph.edges).toHaveLength(3);
    expect(savedGraph.nodes).toHaveLength(3);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toBe(1);
    }
  });

  it('should delete multiple edges identified by type, from, and to', async () => {
    const edgeIdentifier1 = { type: edge2.type, from: edge2.from, to: edge2.to };
    const edgeIdentifier2 = { type: edge3.type, from: edge3.from, to: edge3.to };
    const resultParts = await deleteEdgesTool.execute({ context: mockContext, args: { edges: [edgeIdentifier1, edgeIdentifier2] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.edges.find(e => e.id === edge2.id)).toBeUndefined();
    expect(savedGraph.edges.find(e => e.id === edge3.id)).toBeUndefined();
    expect(savedGraph.edges).toHaveLength(2);
    expect(savedGraph.nodes).toHaveLength(3);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toBe(2);
    }
  });

  it('should delete all matching edges if an identifier matches multiple edges', async () => {
    // Note: Current implementation uses from|to|type as key, so it will delete both e1 and e4
    const edgeIdentifier = { type: edge1.type, from: edge1.from, to: edge1.to };
    const resultParts = await deleteEdgesTool.execute({ context: mockContext, args: { edges: [edgeIdentifier] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.edges.find(e => e.id === edge1.id)).toBeUndefined();
    expect(savedGraph.edges.find(e => e.id === edge4_duplicate.id)).toBeUndefined();
    expect(savedGraph.edges).toHaveLength(2);
    expect(savedGraph.nodes).toHaveLength(3);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toBe(2); // Both matching edges deleted
    }
  });


  it('should return 0 if attempting to delete non-existent edges (by identifier)', async () => {
    const edgeIdentifier = { type: 'NON_EXISTENT', from: node1.id, to: node2.id };
    const resultParts = await deleteEdgesTool.execute({ context: mockContext, args: { edges: [edgeIdentifier] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled(); // No change, should not save

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toBe(0);
    }
  });

  it('should delete existing edges and ignore non-existent ones in the same request', async () => {
    const edgeIdentifier1 = { type: edge2.type, from: edge2.from, to: edge2.to };
    const edgeIdentifier2 = { type: 'NON_EXISTENT', from: node1.id, to: node2.id };
    const resultParts = await deleteEdgesTool.execute({ context: mockContext, args: { edges: [edgeIdentifier1, edgeIdentifier2] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1); // Should save as edge2 is deleted

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.edges.find(e => e.id === edge2.id)).toBeUndefined();
    expect(savedGraph.edges).toHaveLength(3);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toBe(1);
    }
  });

  it('should handle deleting all edges via identifiers', async () => {
    const identifiers = [
        { type: edge1.type, from: edge1.from, to: edge1.to }, // Matches e1, e4
        { type: edge2.type, from: edge2.from, to: edge2.to }, // Matches e2
        { type: edge3.type, from: edge3.from, to: edge3.to }, // Matches e3
    ];
    const resultParts = await deleteEdgesTool.execute({ context: mockContext, args: { edges: identifiers } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.edges).toHaveLength(0);
    expect(savedGraph.nodes).toHaveLength(3);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toBe(4);
    }
  });


  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);
    const edgeIdentifier = { type: edge1.type, from: edge1.from, to: edge1.to };

    // Corrected assertion
    await expect(deleteEdgesTool.execute({ context: mockContext, args: { edges: [edgeIdentifier] } }))
          .rejects.toThrow(); // Just check if it throws
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);
    const edgeIdentifier = { type: edge1.type, from: edge1.from, to: edge1.to };

    // Corrected assertion
    await expect(deleteEdgesTool.execute({ context: mockContext, args: { edges: [edgeIdentifier] } }))
          .rejects.toThrow(); // Just check if it throws
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });
    const edgeIdentifier = { type: edge1.type, from: edge1.from, to: edge1.to };

    // Corrected assertion
    await expect(deleteEdgesTool.execute({ context: mockContext, args: { edges: [edgeIdentifier] } }))
          .rejects.toThrow('Invalid path'); // Expect original error
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});