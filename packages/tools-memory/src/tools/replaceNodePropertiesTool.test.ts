// packages/tools-memory/src/tools/replaceNodePropertiesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceNodePropertiesTool } from './replaceNodePropertiesTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { replaceNodePropertiesToolOutputSchema } from './replaceNodePropertiesTool.schema.js'; // Assuming schema export

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockSaveGraph = vi.mocked(graphUtils.saveGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('replaceNodePropertiesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Person'], properties: { name: 'Alice', age: 30, city: 'London' } };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['City'], properties: { name: 'Berlin' } };

  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    // Deep clone
    mockGraph = {
      nodes: [
        { ...node1, properties: { ...node1.properties } },
        { ...node2, properties: { ...node2.properties } },
      ],
      edges: [],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
    mockSaveGraph.mockResolvedValue(undefined);
  });

  it('should replace all existing properties on a node', async () => {
    const newProperties = { name: 'Alicia', country: 'UK' }; // Completely new set
    const resultParts = await replaceNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: newProperties } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.properties).toEqual(newProperties);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.properties).toEqual(newProperties);
    }
  });

  it('should replace properties with an empty object', async () => {
    const newProperties = {};
    const resultParts = await replaceNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: newProperties } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.properties).toEqual({});

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.properties).toEqual({});
    }
  });

  it('should throw an error if the node ID does not exist', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const newProperties = { name: 'Test' };
    await expect(replaceNodePropertiesTool.execute({ context: mockContext, args: { id: nonExistentId, properties: newProperties } }))
          .rejects.toThrow(`Node with ID ${nonExistentId} not found.`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);

    // Corrected assertion: Check exact error message
    await expect(replaceNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: { name: 'Test' } } }))
          .rejects.toThrow(`Failed to replace properties for node ${node1.id}: Failed to load graph`);
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);

    // Corrected assertion: Check exact error message
    await expect(replaceNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: { name: 'Test' } } }))
          .rejects.toThrow(`Failed to replace properties for node ${node1.id}: Failed to save graph`);
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });

    // Corrected assertion: Expect original error
    await expect(replaceNodePropertiesTool.execute({ context: mockContext, args: { id: node1.id, properties: { name: 'Test' } } }))
          .rejects.toThrow('Invalid path');
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});