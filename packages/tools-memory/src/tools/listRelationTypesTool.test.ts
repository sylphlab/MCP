// packages/tools-memory/src/tools/listRelationTypesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRelationTypesTool } from './listRelationTypesTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node, Edge } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { listRelationTypesToolOutputSchema } from './listRelationTypesTool.schema.js'; // Assuming schema export

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('listRelationTypesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Nodes are needed for edges, but content doesn't matter for this test
  // Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: [], properties: {} };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: [], properties: {} };
  const node3: Node = { id: '33333333-3333-3333-3333-333333333333', labels: [], properties: {} };
  // Edges with various types - Use UUIDs
  const edge1: Edge = { id: 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', from: node1.id, to: node2.id, type: 'KNOWS', properties: {} };
  const edge2: Edge = { id: 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', from: node2.id, to: node3.id, type: 'WORKS_AT', properties: {} };
  const edge3: Edge = { id: 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', from: node3.id, to: node1.id, type: 'KNOWS', properties: {} }; // Duplicate KNOWS
  const edge4: Edge = { id: 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', from: node1.id, to: node3.id, type: 'LIVES_IN', properties: {} };
  const edge5: Edge = { id: 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', from: node2.id, to: node1.id, type: 'WORKS_AT', properties: {} }; // Duplicate WORKS_AT


  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    mockGraph = {
      nodes: [node1, node2, node3],
      edges: [edge1, edge2, edge3, edge4, edge5],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
  });

  it('should list all unique relation types present in the graph', async () => {
    const resultParts = await listRelationTypesTool.execute({ context: mockContext, args: {} });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual(expect.arrayContaining(['KNOWS', 'WORKS_AT', 'LIVES_IN']));
      expect(part.value).toHaveLength(3);
    }
  });

  it('should return an empty array if the graph has no edges', async () => {
    mockGraph.edges = []; // No edges
    mockLoadGraph.mockResolvedValue(mockGraph);
    const resultParts = await listRelationTypesTool.execute({ context: mockContext, args: {} });
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([]);
    }
  });

  it('should return an empty array if the graph has no nodes (and thus no edges)', async () => {
    mockLoadGraph.mockResolvedValue({ nodes: [], edges: [] });
    const resultParts = await listRelationTypesTool.execute({ context: mockContext, args: {} });
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

    // Corrected assertion: Just check if it throws
    await expect(listRelationTypesTool.execute({ context: mockContext, args: {} })).rejects.toThrow();
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion: Expect original error
    await expect(listRelationTypesTool.execute({ context: mockContext, args: {} })).rejects.toThrow('Invalid path');
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).not.toHaveBeenCalled();
  });
});