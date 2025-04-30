// packages/tools-memory/src/tools/createNodesTool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNodesTool } from './createNodesTool';
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { createNodesToolOutputSchema } from './createNodesTool.schema.js';
// No longer importing crypto

// Mock the graphUtils module
vi.mock('../graphUtils', () => ({
  loadGraph: vi.fn(),
  saveGraph: vi.fn(),
  resolveMemoryFilePath: vi.fn((_root, path) => path ?? 'memory.jsonl'),
}));

// No longer mocking crypto
// vi.mock('node:crypto', ...);


const mockLoadGraph = vi.mocked(graphUtils.loadGraph);
const mockSaveGraph = vi.mocked(graphUtils.saveGraph);
const mockResolveMemoryFilePath = vi.mocked(graphUtils.resolveMemoryFilePath);
// No longer mocking randomUUID
// const mockRandomUUID = vi.mocked(crypto.randomUUID);

// Define valid UUIDs for mocking (still useful for existing node ID)
// const mockUuid1 = '123e4567-e89b-12d3-a456-426614174000';
// const mockUuid2 = '123e4567-e89b-12d3-a456-426614174001';


describe('createNodesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  // Use UUID for existing node
  const existingNode: Node = { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', labels: ['Test'], properties: {} };

  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    mockGraph = {
      nodes: [{ ...existingNode }],
      edges: [],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
    mockSaveGraph.mockResolvedValue(undefined);

    // No longer setting up mock UUIDs
    // mockRandomUUID.mockReturnValue(mockUuid1);
  });

  it('should create a single node and generate a valid UUID ID', async () => {
    const newNodeInput = { labels: ['City'], properties: { name: 'New City' } };
    const resultParts = await createNodesTool.execute({ context: mockContext, args: { nodes: [newNodeInput] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    // expect(mockRandomUUID).toHaveBeenCalledTimes(1); // REMOVED
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.nodes).toHaveLength(2);
    const createdNode = savedGraph.nodes.find(n => n.properties.name === 'New City');
    expect(createdNode).toBeDefined();
    expect(createdNode?.id).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/); // Check UUID format
    expect(createdNode?.labels).toEqual(['City']);
    expect(createdNode?.properties).toEqual({ name: 'New City' });

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toHaveLength(1);
      expect(part.value[0].id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
      expect(part.value[0].labels).toEqual(['City']);
      expect(part.value[0].properties).toEqual({ name: 'New City' });
    }
  });

  it('should create multiple nodes and generate valid UUID IDs', async () => {
    const newNodeInput1 = { labels: ['A'], properties: { p: 1 } };
    const newNodeInput2 = { labels: ['B'], properties: { p: 2 } };

    const resultParts = await createNodesTool.execute({ context: mockContext, args: { nodes: [newNodeInput1, newNodeInput2] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    // expect(mockRandomUUID).toHaveBeenCalledTimes(2); // REMOVED
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.nodes).toHaveLength(3);
    const createdNode1 = savedGraph.nodes.find(n => n.labels.includes('A'));
    const createdNode2 = savedGraph.nodes.find(n => n.labels.includes('B'));
    expect(createdNode1?.id).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
    expect(createdNode1?.labels).toEqual(['A']);
    expect(createdNode1?.properties).toEqual({ p: 1 });
    expect(createdNode2?.id).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
    expect(createdNode2?.labels).toEqual(['B']);
    expect(createdNode2?.properties).toEqual({ p: 2 });
    expect(createdNode1?.id).not.toBe(createdNode2?.id); // Ensure IDs are different


    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toHaveLength(2);
      expect(part.value[0].id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
      expect(part.value[0].labels).toEqual(['A']);
      expect(part.value[0].properties).toEqual({ p: 1 });
      expect(part.value[1].id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
      expect(part.value[1].labels).toEqual(['B']);
      expect(part.value[1].properties).toEqual({ p: 2 });
    }
  });

  it('should throw an error if trying to create a node with an existing ID', async () => {
    const newNodeInput = { id: existingNode.id, labels: ['Duplicate'], properties: {} };
    await expect(createNodesTool.execute({ context: mockContext, args: { nodes: [newNodeInput] } }))
          .rejects.toThrow(`Node with provided ID '${existingNode.id}' already exists.`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

   it('should throw an error if trying to create multiple nodes where one has an existing ID', async () => {
    const newNodeInput1 = { labels: ['Good'], properties: {} };
    const newNodeInput2 = { id: existingNode.id, labels: ['Duplicate'], properties: {} };

    await expect(createNodesTool.execute({ context: mockContext, args: { nodes: [newNodeInput1, newNodeInput2] } }))
          .rejects.toThrow(`Node with provided ID '${existingNode.id}' already exists.`);
    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    // expect(mockRandomUUID).toHaveBeenCalledTimes(1); // REMOVED
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });


  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);
    // Corrected assertion
    await expect(createNodesTool.execute({ context: mockContext, args: { nodes: [{ labels: ['Fail'], properties: {} }] } }))
          .rejects.toThrow('Failed to create nodes: Failed to load graph'); // Check exact message
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);
    // Corrected assertion
    await expect(createNodesTool.execute({ context: mockContext, args: { nodes: [{ labels: ['Fail'], properties: {} }] } }))
          .rejects.toThrow('Failed to create nodes: Failed to save graph'); // Check exact message
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });
    // Corrected assertion
    await expect(createNodesTool.execute({ context: mockContext, args: { nodes: [{ labels: ['Fail'], properties: {} }] } }))
          .rejects.toThrow('Invalid path'); // Expect original error
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});