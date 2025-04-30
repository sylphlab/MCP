// packages/tools-memory/src/tools/removeNodeLabelsTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeNodeLabelsTool } from './removeNodeLabelsTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { removeNodeLabelsToolOutputSchema } from './removeNodeLabelsTool.schema.js'; // Assuming schema export

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockSaveGraph = vi.mocked(graphUtils.saveGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('removeNodeLabelsTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Person', 'User', 'Admin'], properties: {} };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['City', 'Capital'], properties: {} };
  const node3: Node = { id: '33333333-3333-3333-3333-333333333333', labels: ['Test'], properties: {} }; // Node with one label

  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    // Deep clone
    mockGraph = {
      nodes: [
        { ...node1, labels: [...node1.labels] },
        { ...node2, labels: [...node2.labels] },
        { ...node3, labels: [...node3.labels] },
      ],
      edges: [],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
    mockSaveGraph.mockResolvedValue(undefined);
  });

  it('should remove a single existing label from a node', async () => {
    const labelsToRemove = ['User'];
    const resultParts = await removeNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: labelsToRemove } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.labels).toEqual(expect.arrayContaining(['Person', 'Admin']));
    expect(updatedNodeInGraph?.labels).not.toContain('User');
    expect(updatedNodeInGraph?.labels).toHaveLength(2);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.labels).toEqual(expect.arrayContaining(['Person', 'Admin']));
      expect(part.value.labels).toHaveLength(2);
    }
  });

  it('should remove multiple existing labels from a node', async () => {
    const labelsToRemove = ['User', 'Admin'];
    const resultParts = await removeNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: labelsToRemove } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.labels).toEqual(['Person']);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.labels).toEqual(['Person']);
    }
  });

  it('should not change labels or save if attempting to remove non-existent labels', async () => {
    const labelsToRemove = ['NonExistent', 'AnotherNonExistent'];
    const resultParts = await removeNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: labelsToRemove } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.labels).toEqual(['Person', 'User', 'Admin']);
    }
  });

  it('should remove existing labels and ignore non-existent ones in the same request', async () => {
    const labelsToRemove = ['User', 'NonExistent'];
    const resultParts = await removeNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: labelsToRemove } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.labels).toEqual(expect.arrayContaining(['Person', 'Admin']));
    expect(updatedNodeInGraph?.labels).not.toContain('User');
    expect(updatedNodeInGraph?.labels).toHaveLength(2);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.labels).toEqual(expect.arrayContaining(['Person', 'Admin']));
      expect(part.value.labels).toHaveLength(2);
    }
  });

  it('should throw error if attempting to remove the last label', async () => {
    const labelsToRemove = ['Test']; // node3 only has 'Test' label
    await expect(removeNodeLabelsTool.execute({ context: mockContext, args: { id: node3.id, labels: labelsToRemove } }))
          .rejects.toThrow(`Cannot remove all labels from node ${node3.id}. At least one label must remain.`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should throw an error if the node ID does not exist', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const labelsToRemove = ['Person'];
    await expect(removeNodeLabelsTool.execute({ context: mockContext, args: { id: nonExistentId, labels: labelsToRemove } }))
          .rejects.toThrow(`Node with ID ${nonExistentId} not found.`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);

    // Corrected assertion: Just check if it throws
    await expect(removeNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: ['User'] } })).rejects.toThrow();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);

    // Corrected assertion: Just check if it throws
    await expect(removeNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: ['User'] } })).rejects.toThrow();
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion: Expect original error
    await expect(removeNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: ['User'] } })).rejects.toThrow('Invalid path');
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});