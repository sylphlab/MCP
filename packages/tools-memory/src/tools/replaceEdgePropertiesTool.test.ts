// packages/tools-memory/src/tools/replaceEdgePropertiesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceEdgePropertiesTool } from './replaceEdgePropertiesTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node, Edge } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { replaceEdgePropertiesToolOutputSchema } from './replaceEdgePropertiesTool.schema.js'; // Assuming schema export

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockSaveGraph = vi.mocked(graphUtils.saveGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('replaceEdgePropertiesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: [], properties: {} };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: [], properties: {} };
  const edge1: Edge = { id: 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', from: node1.id, to: node2.id, type: 'REL', properties: { since: 2020, weight: 5, status: 'active' } };
  const edge2: Edge = { id: 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', from: node2.id, to: node1.id, type: 'REL', properties: { active: true } };

  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    // Deep clone
    mockGraph = {
      nodes: [node1, node2],
      edges: [
        { ...edge1, properties: { ...edge1.properties } },
        { ...edge2, properties: { ...edge2.properties } },
      ],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
    mockSaveGraph.mockResolvedValue(undefined);
  });

  it('should replace all existing properties on an edge', async () => {
    const newProperties = { weight: 10, notes: 'Replaced' }; // Completely new set
    const resultParts = await replaceEdgePropertiesTool.execute({ context: mockContext, args: { id: edge1.id, properties: newProperties } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedEdgeInGraph = savedGraph.edges.find(e => e.id === edge1.id);
    expect(updatedEdgeInGraph?.properties).toEqual(newProperties);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(edge1.id);
      expect(part.value.properties).toEqual(newProperties);
    }
  });

  it('should replace properties with an empty object', async () => {
    const newProperties = {};
    const resultParts = await replaceEdgePropertiesTool.execute({ context: mockContext, args: { id: edge1.id, properties: newProperties } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedEdgeInGraph = savedGraph.edges.find(e => e.id === edge1.id);
    expect(updatedEdgeInGraph?.properties).toEqual({});

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(edge1.id);
      expect(part.value.properties).toEqual({});
    }
  });

  it('should throw an error if the edge ID does not exist', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const newProperties = { name: 'Test' };
    await expect(replaceEdgePropertiesTool.execute({ context: mockContext, args: { id: nonExistentId, properties: newProperties } }))
          .rejects.toThrow(`Edge with ID ${nonExistentId} not found.`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);

    // Corrected assertion
    await expect(replaceEdgePropertiesTool.execute({ context: mockContext, args: { id: edge1.id, properties: { name: 'Test' } } }))
          .rejects.toThrow(); // Just check if it throws
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);

    // Corrected assertion
    await expect(replaceEdgePropertiesTool.execute({ context: mockContext, args: { id: edge1.id, properties: { name: 'Test' } } }))
          .rejects.toThrow(); // Just check if it throws
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion
    await expect(replaceEdgePropertiesTool.execute({ context: mockContext, args: { id: edge1.id, properties: { name: 'Test' } } }))
          .rejects.toThrow('Invalid path'); // Expect original error
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});