// packages/tools-memory/src/tools/createEdgesTool.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'; // Added afterEach back
import { createEdgesTool } from './createEdgesTool';
import * as graphUtils from '../graphUtils';
import type { KnowledgeGraph, MemoryContext, Node, Edge } from '../types';
import { jsonPart } from '@sylphlab/tools-core';
import { createEdgesToolOutputSchema } from './createEdgesTool.schema.js';
// No longer importing crypto

// Mock graphUtils
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

// Define valid UUIDs for mocking (still useful for existing node/edge IDs)
// const mockEdgeUuid1 = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
// const mockEdgeUuid2 = 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2';

describe('createEdgesTool', () => {
  let mockGraph: KnowledgeGraph;
  let mockContext: MemoryContext;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  // Use UUIDs for nodes
  const node1: Node = { id: '11111111-1111-1111-1111-111111111111', labels: ['Test'], properties: {} };
  const node2: Node = { id: '22222222-2222-2222-2222-222222222222', labels: ['Test'], properties: {} };
  const existingEdge: Edge = { id: 'exist-edge-1111-1111-111111111111', from: node1.id, to: node2.id, type: 'EXISTING', properties: {} };

  beforeEach(() => {
    vi.resetAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockContext = {
      workspaceRoot: '/mock/workspace',
      memoryFilePath: 'test-memory.jsonl',
    };

    mockGraph = {
      nodes: [{ ...node1 }, { ...node2 }],
      edges: [{ ...existingEdge }],
    };

    mockLoadGraph.mockResolvedValue(mockGraph);
    mockResolveMemoryFilePath.mockReturnValue('test-memory.jsonl');
    mockSaveGraph.mockResolvedValue(undefined);

    // No longer setting up mock UUIDs
    // mockRandomUUID.mockReturnValue(mockEdgeUuid1);
  });

  afterEach(() => {
      consoleWarnSpy.mockRestore();
  });

  it('should create a single edge and generate an ID', async () => {
    const newEdgeInput = { type: 'CONNECTS', from: node1.id, to: node2.id, properties: { weight: 1 } };
    const resultParts = await createEdgesTool.execute({ context: mockContext, args: { edges: [newEdgeInput] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    // expect(mockRandomUUID).toHaveBeenCalledTimes(1); // REMOVED
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.edges).toHaveLength(2);
    const createdEdge = savedGraph.edges.find(e => e.type === 'CONNECTS');
    expect(createdEdge).toBeDefined();
    expect(createdEdge?.id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)); // Check format
    expect(createdEdge?.from).toBe(node1.id);
    expect(createdEdge?.to).toBe(node2.id);
    expect(createdEdge?.properties).toEqual({ weight: 1 });

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toHaveLength(1);
      expect(part.value[0].id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
      expect(part.value[0].type).toBe('CONNECTS');
      // ... other checks ...
    }
  });

  it('should create multiple edges and generate IDs', async () => {
    const newEdgeInput1 = { type: 'RELATES_TO', from: node1.id, to: node2.id };
    const newEdgeInput2 = { type: 'RELATES_TO', from: node2.id, to: node1.id, properties: { symmetric: true } };

    const resultParts = await createEdgesTool.execute({ context: mockContext, args: { edges: [newEdgeInput1, newEdgeInput2] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    // expect(mockRandomUUID).toHaveBeenCalledTimes(2); // REMOVED
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.edges).toHaveLength(3);
    const createdEdge1 = savedGraph.edges.find(e => e.from === node1.id && e.type === 'RELATES_TO');
    const createdEdge2 = savedGraph.edges.find(e => e.from === node2.id && e.type === 'RELATES_TO');

    expect(createdEdge1?.id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    expect(createdEdge1?.type).toBe('RELATES_TO');
    // ... other checks ...

    expect(createdEdge2?.id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    expect(createdEdge2?.type).toBe('RELATES_TO');
    // ... other checks ...
    expect(createdEdge1?.id).not.toBe(createdEdge2?.id);

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toHaveLength(2);
      expect(part.value[0].id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
      expect(part.value[1].id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    }
  });

  it('should not create an edge if it already exists (same type, from, to)', async () => {
    const duplicateEdgeInput = { type: existingEdge.type, from: existingEdge.from, to: existingEdge.to };

    const resultParts = await createEdgesTool.execute({ context: mockContext, args: { edges: [duplicateEdgeInput] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    // expect(mockRandomUUID).not.toHaveBeenCalled(); // REMOVED
    expect(mockSaveGraph).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping duplicate edge creation:'));

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([]);
    }
  });


  it('should skip creating an edge if "from" node does not exist and warn', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const invalidEdgeInput = { type: 'INVALID', from: nonExistentId, to: node2.id };

    const resultParts = await createEdgesTool.execute({ context: mockContext, args: { edges: [invalidEdgeInput] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
    // Corrected: Check console.warn was called
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`'from' node with ID ${nonExistentId} does not exist`));

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([]);
    }
  });

  it('should skip creating an edge if "to" node does not exist and warn', async () => {
    const nonExistentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const invalidEdgeInput = { type: 'INVALID', from: node1.id, to: nonExistentId };

    const resultParts = await createEdgesTool.execute({ context: mockContext, args: { edges: [invalidEdgeInput] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).not.toHaveBeenCalled();
    // Corrected: Check console.warn was called
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`'to' node with ID ${nonExistentId} does not exist`));

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toEqual([]);
    }
  });

  it('should skip invalid edges and create valid ones in the same batch', async () => {
    const validEdgeInput = { type: 'NEW_REL', from: node1.id, to: node2.id };
    const invalidEdgeInput = { type: 'INVALID', from: node1.id, to: 'ffffffff-ffff-ffff-ffff-ffffffffffff' };
    // No need to mock UUID specifically if just checking format
    // mockRandomUUID.mockReset();
    // mockRandomUUID.mockReturnValueOnce(mockEdgeUuid1);

    const resultParts = await createEdgesTool.execute({ context: mockContext, args: { edges: [validEdgeInput, invalidEdgeInput] } });

    expect(mockLoadGraph).toHaveBeenCalledWith('test-memory.jsonl');
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    // expect(mockRandomUUID).toHaveBeenCalledTimes(1); // REMOVED

    const savedGraph = mockSaveGraph.mock.calls[0][1];
    expect(savedGraph.edges).toHaveLength(2);
    const createdEdge = savedGraph.edges.find(e => e.type === 'NEW_REL');
    expect(createdEdge?.id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));

    expect(resultParts).toHaveLength(1);
    const part = resultParts[0];
    expect(part.type).toBe('json');
    if (part.type === 'json') {
      expect(part.value).toHaveLength(1);
      expect(part.value[0].id).toEqual(expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/));
    }
  });


  it('should handle errors during graph loading', async () => {
    const loadError = new Error('Failed to load graph');
    mockLoadGraph.mockRejectedValue(loadError);
    const newEdgeInput = { type: 'CONNECTS', from: node1.id, to: node2.id };

    // Corrected assertion
    await expect(createEdgesTool.execute({ context: mockContext, args: { edges: [newEdgeInput] } })).rejects.toThrow();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });

  it('should handle errors during graph saving', async () => {
    const saveError = new Error('Failed to save graph');
    mockSaveGraph.mockRejectedValue(saveError);
    const newEdgeInput = { type: 'CONNECTS', from: node1.id, to: node2.id };
    // No need to mock UUID if not checking call count
    // mockRandomUUID.mockReset();
    // mockRandomUUID.mockReturnValueOnce(mockEdgeUuid1);

    // Corrected assertion
    await expect(createEdgesTool.execute({ context: mockContext, args: { edges: [newEdgeInput] } })).rejects.toThrow();
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during file path resolution', async () => {
    const resolveError = new Error('Invalid path');
    mockResolveMemoryFilePath.mockImplementation(() => { throw resolveError; });
    const newEdgeInput = { type: 'CONNECTS', from: node1.id, to: node2.id };

    // Corrected assertion
    await expect(createEdgesTool.execute({ context: mockContext, args: { edges: [newEdgeInput] } })).rejects.toThrow('Invalid path');
    expect(mockLoadGraph).not.toHaveBeenCalled();
    expect(mockSaveGraph).not.toHaveBeenCalled();
  });
});