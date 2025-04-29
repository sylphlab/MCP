import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema
import type { ToolExecuteOptions as CoreToolExecuteOptions } from '@sylphlab/tools-core'; // Use alias again
import { z } from 'zod'; // Import z

/**
 * Extends the core ToolExecuteOptions to include memory-specific options.
 */
export interface MemoryToolExecuteOptions extends CoreToolExecuteOptions { // Extend the aliased type
  /** Optional override for the memory file path. */
  memoryFilePath?: string;
}

/**
 * Zod schema corresponding to MemoryToolExecuteOptions.
 */
export const MemoryContextSchema = BaseContextSchema.extend({
  memoryFilePath: z.string().optional(),
});
export type MemoryContext = z.infer<typeof MemoryContextSchema>;


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