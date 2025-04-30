// packages/tools-memory/src/tools/updateNodePropertiesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateNodePropertiesTool } from './updateNodePropertiesTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { updateNodePropertiesToolOutputSchema } from './updateNodePropertiesTool.schema.js'; // Assuming schema export

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(), // Need to mock saveGraph for update tools
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockSaveGraph = vi.mocked(graphUtils.saveGraph); // Mock saveGraph
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('updateNodePropertiesTool', () => {
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

    // Deep clone to prevent tests interfering with each other via object mutation
    mockGraph = {
      nodes: [
        { ...node1, properties: { ...node1.properties } },
        { ...node2, properties: { ...node2.properties } },
      ],
      edges: [],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
    mockSaveGraph.mockResolvedValue(undefined); // Default successful save
  });

  it('should update an existing property on a node', async () => {
    const updates = { age: 31 };
    const resultParts = await updateNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: updates } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.properties).toEqual({ name: 'Alice', age: 31 });

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.properties).toEqual({ name: 'Alice', age: 31 });
    }
  });

  it('should add a new property to a node', async () => {
    const updates = { city: 'London' };
    const resultParts = await updateNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: updates } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.properties).toEqual({ name: 'Alice', age: 30, city: 'London' });

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.properties).toEqual({ name: 'Alice', age: 30, city: 'London' });
    }
  });

  it('should update existing and add new properties simultaneously', async () => {
    const updates = { age: 32, city: 'London' };
    const resultParts = await updateNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: updates } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.properties).toEqual({ name: 'Alice', age: 32, city: 'London' });

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.properties).toEqual({ name: 'Alice', age: 32, city: 'London' });
    }
  });

  it('should throw an error if the node ID does not exist', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const updates = { age: 99 };
    await expect(updateNodePropertiesTool.execute({ context: mockContext, args: { id: nonExistentId, properties: updates } }))
          .rejects.toThrow(`Node with ID ${nonExistentId} not found.`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);

    // Corrected assertion
    await expect(updateNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: { age: 31 } } }))
          .rejects.toThrow(); // Just check if it throws
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);

    // Corrected assertion
    await expect(updateNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: { age: 31 } } }))
          .rejects.toThrow(); // Just check if it throws
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion
    await expect(updateNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: { age: 31 } } }))
          .rejects.toThrow('Invalid path'); // Expect original error
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});