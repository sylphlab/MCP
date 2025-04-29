import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Entity, Relation, KnowledgeGraph } from './types'; // Assuming interfaces are moved/defined in types.ts

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
 * Loads the knowledge graph from the specified file path.
 * @param memoryFilePath The absolute path to the memory file.
 * @returns The loaded knowledge graph.
 */
export async function loadGraph(memoryFilePath: string): Promise<KnowledgeGraph> {
  try {
    const data = await fs.readFile(memoryFilePath, "utf-8");
    if (!data.trim()) {
      return { entities: [], relations: [] };
    }
    const lines = data.split("\n").filter((line: string) => line.trim() !== "");
    // Use reduce with proper typing and error handling
    return lines.reduce<KnowledgeGraph>((graph, line, index) => {
      try {
        const item = JSON.parse(line);
        // Add stricter type validation if possible (e.g., using Zod schemas)
        if (item.type === "entity" && item.name && item.entityType && Array.isArray(item.observations)) {
           graph.entities.push(item as Entity);
        } else if (item.type === "relation" && item.from && item.to && item.relationType) {
           graph.relations.push(item as Relation);
        } else {
           console.warn(`[graphUtils] Skipping invalid line ${index + 1} in memory file: ${line}`);
        }
      } catch (parseError) {
         console.error(`[graphUtils] Error parsing line ${index + 1} in memory file: ${line}`, parseError);
      }
      return graph;
    }, { entities: [], relations: [] });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
      return { entities: [], relations: [] }; // File not found is okay
    }
    console.error(`[graphUtils] Error loading knowledge graph from ${memoryFilePath}:`, error);
    throw error; // Re-throw other critical errors
  }
}

/**
 * Saves the knowledge graph to the specified file path.
 * @param memoryFilePath The absolute path to the memory file.
 * @param graph The knowledge graph to save.
 */
export async function saveGraph(memoryFilePath: string, graph: KnowledgeGraph): Promise<void> {
  await ensureMemoryDirExists(memoryFilePath);
  // Filter potentially invalid entries before saving
  const validEntities = graph.entities.filter((e): e is Entity => !!(e?.name && e?.entityType && Array.isArray(e.observations))); // Type guard
  const validRelations = graph.relations.filter((r): r is Relation => !!(r?.from && r?.to && r.relationType)); // Type guard

  const lines = [
    ...validEntities.map((e: Entity) => JSON.stringify({ type: "entity", ...e })),
    ...validRelations.map((r: Relation) => JSON.stringify({ type: "relation", ...r })),
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
    // Restore original logic
    const defaultMemoryPath = path.join(workspaceRoot, 'memory.jsonl');
    return memoryFilePathOverride
      ? path.resolve(workspaceRoot, memoryFilePathOverride)
      : defaultMemoryPath;
}