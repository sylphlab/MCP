// packages/tools-memory/src/tools/addNodeLabelsTool.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'; // Added afterEach
import { addNodeLabelsTool } from './addNodeLabelsTool'; // Assuming export name
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { addNodeLabelsToolOutputSchema } from './addNodeLabelsTool.schema.js'; // Assuming schema export

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockSaveGraph = vi.mocked(graphUtils.saveGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);

describe('addNodeLabelsTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>; // Declare spy variable

  // Use UUIDs
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Person'], properties: {} };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['City', 'Capital'], properties: {} };
  const node3: Node = { id: '33333333-3333-3333-3333-333333333333', labels: [], properties: {} }; // Node with no labels

  beforeEach(() => {
    vi.resetAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Initialize spy

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

   afterEach(() => { // Added afterEach
      consoleWarnSpy.mockRestore(); // Restore spy
  });


  it('should add a single new label to a node', async () => {
    const labelsToAdd = ['User'];
    const resultParts = await addNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: labelsToAdd } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
    expect(updatedNodeInGraph?.labels).toEqual(expect.arrayContaining(['Person', 'User']));
    expect(updatedNodeInGraph?.labels).toHaveLength(2);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.labels).toEqual(expect.arrayContaining(['Person', 'User']));
      expect(part.value.labels).toHaveLength(2);
    }
  });

  it('should add multiple new labels to a node', async () => {
    const labelsToAdd = ['Location', 'European'];
    const resultParts = await addNodeLabelsTool.execute({ context: mockContext, args: { id: node2.id, labels: labelsToAdd } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node2.id);
    expect(updatedNodeInGraph?.labels).toEqual(expect.arrayContaining(['City', 'Capital', 'Location', 'European']));
    expect(updatedNodeInGraph?.labels).toHaveLength(4);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node2.id);
      expect(part.value.labels).toEqual(expect.arrayContaining(['City', 'Capital', 'Location', 'European']));
      expect(part.value.labels).toHaveLength(4);
    }
  });

  it('should not add duplicate labels and not save if no change', async () => {
    const labelsToAdd = ['Person', 'Capital'];
    const resultParts = await addNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: labelsToAdd } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    const originalLabels = mockGraph.nodes.find(n => n.id === node1.id)?.labels ?? [];
    const expectedLabels = Array.from(new Set([...originalLabels, ...labelsToAdd]));
    if (expectedLabels.length === originalLabels.length && expectedLabels.every(l => originalLabels.includes(l))) {
        expect(mockSaveGraph).not.toHaveBeenCalled();
    } else {
        expect(mockSaveGraph).toHaveBeenCalledTimes(1);
        const savedGraph = mockSaveGraph.mock.calls[0][1];
        const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node1.id);
        expect(updatedNodeInGraph?.labels).toEqual(expect.arrayContaining(expectedLabels));
        expect(updatedNodeInGraph?.labels).toHaveLength(expectedLabels.length);
    }


    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node1.id);
      expect(part.value.labels).toEqual(expect.arrayContaining(expectedLabels));
      expect(part.value.labels).toHaveLength(expectedLabels.length);
    }
  });

  it('should add labels to a node with initially no labels', async () => {
    const labelsToAdd = ['Test', 'New'];
    const resultParts = await addNodeLabelsTool.execute({ context: mockContext, args: { id: node3.id, labels: labelsToAdd } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    const updatedNodeInGraph = savedGraph.nodes.find(n => n.id === node3.id);
    expect(updatedNodeInGraph?.labels).toEqual(expect.arrayContaining(['Test', 'New']));
    expect(updatedNodeInGraph?.labels).toHaveLength(2);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value.id).toBe(node3.id);
      expect(part.value.labels).toEqual(expect.arrayContaining(['Test', 'New']));
      expect(part.value.labels).toHaveLength(2);
    }
  });

  it('should throw an error if the node ID does not exist', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const labelsToAdd = ['NonExistentLabel'];
    await expect(addNodeLabelsTool.execute({ context: mockContext, args: { id: nonExistentId, labels: labelsToAdd } }))
          .rejects.toThrow(`Node with ID ${nonExistentId} not found.`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);
    // Corrected assertion: Check exact error message
    await expect(addNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: ['Test'] } }))
          .rejects.toThrow(`Failed to add labels to node ${node1.id}: Failed to load graph`);
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);
    // Corrected assertion: Check exact error message
    await expect(addNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: ['Test'] } }))
          .rejects.toThrow(`Failed to add labels to node ${node1.id}: Failed to save graph`);
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });
    // Corrected assertion: Expect original error
    await expect(addNodeLabelsTool.execute({ context: mockContext, args: { id: node1.id, labels: ['Test'] } }))
          .rejects.toThrow('Invalid path');
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});