// packages/tools-memory/src/tools/findRelatedNodesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findRelatedNodesTool } from './findRelatedNodesTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node, Edge } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { findRelatedNodesToolOutputSchema } from './findRelatedNodesTool.schema.js'; // Assuming schema export

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('findRelatedNodesTool', () => {
  let mockContext: MemoryContext;
  // Nodes - Use UUIDs now
  const nodeA: Node = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', labels: ['Person'], properties: { name: 'Alice' } };
  const nodeB: Node = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', labels: ['Person'], properties: { name: 'Bob' } };
  const nodeC: Node = { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', labels: ['City'], properties: { name: 'Berlin' } };
  const nodeD: Node = { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', labels: ['Company'], properties: { name: 'Acme' } };
  const nodeE: Node = { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', labels: ['Person'], properties: { name: 'Eve' } };
  // Edges - Use UUIDs and add edge IDs
  const edgeAB_knows: Edge = { id: 'e1', from: nodeA.id, to: nodeB.id, type: 'KNOWS', properties: {} };
  const edgeAC_lives: Edge = { id: 'e2', from: nodeA.id, to: nodeC.id, type: 'LIVES_IN', properties: {} };
  const edgeBC_visits: Edge = { id: 'e3', from: nodeB.id, to: nodeC.id, type: 'VISITS', properties: {} };
  const edgeBD_works: Edge = { id: 'e4', from: nodeB.id, to: nodeD.id, type: 'WORKS_AT', properties: {} }; // B -> D
  const edgeCA_contains: Edge = { id: 'e5', from: nodeC.id, to: nodeA.id, type: 'CONTAINS', properties: {} }; // Incoming to A
  const edgeDA_employs: Edge = { id: 'e6', from: nodeD.id, to: nodeA.id, type: 'EMPLOYS', properties: {} }; // Incoming to A
  const edgeEB_knows: Edge = { id: 'e7', from: nodeE.id, to: nodeB.id, type: 'KNOWS', properties: {} }; // Outgoing from E

  // Function to create a deep copy of the initial graph state
  const getInitialGraph = (): KnowledgeGraph => ({
      nodes: [
        { ...nodeA, properties: { ...nodeA.properties }, labels: [...nodeA.labels] },
        { ...nodeB, properties: { ...nodeB.properties }, labels: [...nodeB.labels] },
        { ...nodeC, properties: { ...nodeC.properties }, labels: [...nodeC.labels] },
        { ...nodeD, properties: { ...nodeD.properties }, labels: [...nodeD.labels] },
        { ...nodeE, properties: { ...nodeE.properties }, labels: [...nodeE.labels] },
      ],
      edges: [
        { ...edgeAB_knows, properties: { ...edgeAB_knows.properties } },
        { ...edgeAC_lives, properties: { ...edgeAC_lives.properties } },
        { ...edgeBC_visits, properties: { ...edgeBC_visits.properties } },
        { ...edgeBD_works, properties: { ...edgeBD_works.properties } },
        { ...edgeCA_contains, properties: { ...edgeCA_contains.properties } },
        { ...edgeDA_employs, properties: { ...edgeDA_employs.properties } },
        { ...edgeEB_knows, properties: { ...edgeEB_knows.properties } },
      ],
  });


  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    // Use deep copy for mockLoadGraph
    mockLoadGraph.mockResolvedValue(getInitialGraph());
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
  });

  // --- Direction Tests ---

  it('should find outgoing related nodes explicitly', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, direction: 'outgoing', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual(expect.arrayContaining([nodeB, nodeC]));
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(2);
    }
  });

  it('should find incoming related nodes', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, direction: 'incoming', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual(expect.arrayContaining([nodeC, nodeD]));
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(2);
    }
  });

  it('should find related nodes in both directions (default)', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual(expect.arrayContaining([nodeB, nodeC, nodeD]));
      expect(part.value.nodes).toHaveLength(3);
      expect(part.value.totalCount).toBe(3);
    }
  });

  // --- Relation Type Filter Tests ---

  it('should filter outgoing nodes by relation type', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, relation_type: 'KNOWS', direction: 'outgoing', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([nodeB]);
      expect(part.value.totalCount).toBe(1);
    }
  });

  it('should filter incoming nodes by relation type', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, relation_type: 'EMPLOYS', direction: 'incoming', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([nodeD]);
      expect(part.value.totalCount).toBe(1);
    }
  });

  it('should filter nodes in both directions by relation type', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeB.id, relation_type: 'KNOWS', direction: 'both', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual(expect.arrayContaining([nodeA, nodeE]));
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(2);
    }
  });

  // --- Pagination Tests ---

  it('should limit results', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, direction: 'both', limit: 2, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(3);
    }
  });

  it('should apply offset to results', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, direction: 'both', limit: 2, offset: 1 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toHaveLength(2);
      expect(part.value.totalCount).toBe(3);
    }
  });

  // --- Edge Cases ---

  it('should return empty array if start node does not exist', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nonExistentId, limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([]);
      expect(part.value.totalCount).toBe(0);
    }
  });

  it('should return correct node if start node has only outgoing relations', async () => { // Corrected test description and assertion
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeE.id, direction: 'outgoing', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([nodeB]); // E -> B via KNOWS
      expect(part.value.totalCount).toBe(1);
    }
  });

   it('should return correct node if start node has only incoming relations', async () => { // Corrected test description and assertion
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeD.id, direction: 'incoming', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([nodeB]); // B -> D via WORKS_AT
      expect(part.value.totalCount).toBe(1);
    }
  });

  it('should return empty array if filter type does not match', async () => {
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, relation_type: 'NON_EXISTENT_TYPE', limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([]);
      expect(part.value.totalCount).toBe(0);
    }
  });

  it('should return empty array if graph is empty', async () => {
    mockLoadGraph.mockResolvedValue({ nodes: [], edges: [] });
    const resultParts = await findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, limit: 50, offset: 0 } });
    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    if (part.type === 'json') {
      expect(part.value.nodes).toEqual([]);
      expect(part.value.totalCount).toBe(0);
    }
  });

  // --- Error Handling ---

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);
    // Corrected assertion: Check exact error message
    await expect(findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, limit: 50, offset: 0 } }))
          .rejects.toThrow(`Failed to find related nodes for ${nodeA.id}: Failed to load graph`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });
    // Corrected assertion: Expect original error
    await expect(findRelatedNodesTool.execute({ context: mockContext, args: { start_node_id: nodeA.id, limit: 50, offset: 0 } }))
          .rejects.toThrow('Invalid path');
    expect(mockResolveMemoryFilePath).toHaveBeenCalledWith(mockContext.workspaceRoot, mockContext.memoryFilePath);
    expect(mockLoadGraph).not.toHaveBeenCalled();
  });
});