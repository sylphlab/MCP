import type { ToolExecuteOptions as CoreToolExecuteOptions } from '@sylphlab/tools-core'; // Use alias again

/**
 * Extends the core ToolExecuteOptions to include memory-specific options.
 */
export interface MemoryToolExecuteOptions extends CoreToolExecuteOptions { // Extend the aliased type
  /** Optional override for the memory file path. */
  memoryFilePath?: string;
}

// --- Knowledge Graph Specific Types ---

export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}