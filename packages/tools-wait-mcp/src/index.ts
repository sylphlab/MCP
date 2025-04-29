import process from 'node:process';
import type { ToolDefinition, ToolExecuteOptions } from '@sylphlab/tools-core'; // Use ToolDefinition
import { startMcpServer } from '@sylphlab/tools-adaptor-mcp';
import { waitTool } from '@sylphlab/tools-wait';
import { description, name, version } from '../package.json'; // Import metadata

// --- Server Setup ---

const tools: ToolDefinition<any>[] = [waitTool]; // Use ToolDefinition

// --- Server Start ---
// Directly call startMcpServer at the top level
(async () => {
  const toolOptions: ToolExecuteOptions = {
    workspaceRoot: process.cwd(),
    // Add other options if needed, e.g., allowOutsideWorkspace: false
  };
  try {
    await startMcpServer(
      {
        name, // Use name from package.json
        version, // Use version from package.json
        description, // Use description from package.json
        tools,
      },
      toolOptions, // Pass the created options object
    );
  } catch (_error) {
    // Error handling is inside startMcpServer
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});
process.on('SIGTERM', () => {
  process.exit(0);
});
