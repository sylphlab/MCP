import path from 'node:path';
import { promises as fs } from 'node:fs';
// Import the new Property Graph types and Zod schemas
import {
  type Node, NodeSchema,
  type Edge, EdgeSchema,
  type KnowledgeGraph, KnowledgeGraphSchema
} from './types';
import { ZodError } from 'zod'; // Import ZodError for detailed validation errors

/**
 * Ensures the directory for the memory file exists.
 * @param memoryFilePath The absolute path to the memory file.
 */
async function ensureMemoryDirExists(memoryFilePath: string): Promise<void> {
  const memoryDir = path.dirname(memoryFilePath);
  try {
    await fs.mkdir(memoryDir, { recursive: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code !== 'EEXIST') {
      console.error(`[graphUtils] Error creating directory ${memoryDir}:`, error);
      throw error; // Re-throw critical error
    }
    // Ignore EEXIST
  }
}

/**
 * Loads the knowledge graph from the specified file path using the new schema.
 * @param memoryFilePath The absolute path to the memory file.
 * @returns The loaded knowledge graph.
 */
export async function loadGraph(memoryFilePath: string): Promise<KnowledgeGraph> {
  try {
    const data = await fs.readFile(memoryFilePath, "utf-8");
    if (!data.trim()) {
      return { nodes: [], edges: [] }; // Return empty graph with new structure
    }
    const lines = data.split("\n").filter((line: string) => line.trim() !== "");

    return lines.reduce<KnowledgeGraph>((graph, line, index) => {
      try {
        const item = JSON.parse(line);
        // Use Zod schemas for validation
        if (item.labels && item.properties && item.id) { // Check for node structure
          const parseResult = NodeSchema.safeParse(item);
          if (parseResult.success) {
            graph.nodes.push(parseResult.data);
          } else {
            console.warn(`[graphUtils] Skipping invalid node line ${index + 1}: ${parseResult.error.message}`, item);
          }
        } else if (item.type && item.from && item.to) { // Check for edge structure
          const parseResult = EdgeSchema.safeParse(item);
          if (parseResult.success) {
            graph.edges.push(parseResult.data);
          } else {
            console.warn(`[graphUtils] Skipping invalid edge line ${index + 1}: ${parseResult.error.message}`, item);
          }
        } else {
           console.warn(`[graphUtils] Skipping unrecognized line ${index + 1} in memory file: ${line}`);
        }
      } catch (parseError) {
         console.error(`[graphUtils] Error parsing line ${index + 1} in memory file: ${line}`, parseError);
      }
      return graph;
    }, { nodes: [], edges: [] }); // Initialize with new structure

  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
      return { nodes: [], edges: [] }; // File not found is okay, return empty graph
    }
    console.error(`[graphUtils] Error loading knowledge graph from ${memoryFilePath}:`, error);
    throw error; // Re-throw other critical errors
  }
}

/**
 * Saves the knowledge graph to the specified file path using the new schema.
 * @param memoryFilePath The absolute path to the memory file.
 * @param graph The knowledge graph to save.
 */
export async function saveGraph(memoryFilePath: string, graph: KnowledgeGraph): Promise<void> {
  await ensureMemoryDirExists(memoryFilePath);

  // Validate the entire graph structure before saving (optional but recommended)
  try {
    KnowledgeGraphSchema.parse(graph); // Validate nodes and edges against their schemas
  } catch (validationError) {
    if (validationError instanceof ZodError) {
      console.error('[graphUtils] Invalid graph structure, cannot save:', validationError.errors);
    } else {
      console.error('[graphUtils] Unknown validation error, cannot save:', validationError);
    }
    throw new Error("Invalid graph structure provided to saveGraph.");
  }

  // No need for explicit type field anymore if structure is distinct
  const lines = [
    ...graph.nodes.map((n: Node) => JSON.stringify(n)), // Nodes don't need explicit 'type'
    ...graph.edges.map((e: Edge) => JSON.stringify(e)), // Edges don't need explicit 'type'
  ];

  try {
      await fs.writeFile(memoryFilePath, lines.join("\n"));
  } catch (writeError) {
      console.error(`[graphUtils] Error saving knowledge graph to ${memoryFilePath}:`, writeError);
      throw writeError;
  }
}

/**
 * Resolves the memory file path based on workspace root and optional override.
 * @param workspaceRoot The absolute path to the workspace root.
 * @param memoryFilePathOverride Optional path override (relative or absolute).
 * @returns The absolute path to the memory file.
 */
export function resolveMemoryFilePath(workspaceRoot: string, memoryFilePathOverride?: string): string {
    // Keep original logic
    const defaultMemoryPath = path.join(workspaceRoot, 'memory.jsonl');
    return memoryFilePathOverride
      ? path.resolve(workspaceRoot, memoryFilePathOverride)
      : defaultMemoryPath;
}