import type { ToolExecuteOptions as CoreToolExecuteOptions } from '@sylphlab/tools-core'; // Use alias again

/**
 * Extends the core ToolExecuteOptions to include memory-specific options.
 */
export interface MemoryToolExecuteOptions extends CoreToolExecuteOptions { // Extend the aliased type
  /** Optional override for the memory file path. */
  memoryFilePath?: string;
}