// src/index.ts for @sylphlab/mcp-filesystem-core

// Export available tools
export { copyItemsTool } from './tools/copyItemsTool.js';
export { createFolderTool } from './tools/createFolderTool.js';
export { deleteItemsTool } from './tools/deleteItemsTool.js';
export { editFileTool } from './tools/editFileTool.js';
export { listFilesTool } from './tools/listFilesTool.js';
export { moveRenameItemsTool } from './tools/moveRenameItemsTool.js';
export { readFilesTool } from './tools/readFilesTool.js';
export { replaceContentTool } from './tools/replaceContentTool.js';
export { searchContentTool } from './tools/searchContentTool.js';
export { statItemsTool } from './tools/statItemsTool.js';
export { writeFilesTool } from './tools/writeFilesTool.js';

// Export types if needed later
// export * from './tools/copyItemsTool';
// export * from './tools/createFolderTool';
// export * from './tools/deleteItemsTool';
// export * from './tools/editFileTool';
// export * from './tools/listFilesTool';
// export * from './tools/moveRenameItemsTool';
// export * from './tools/readFilesTool';
// export * from './tools/replaceContentTool';
// export * from './tools/searchContentTool';
// export * from './tools/statItemsTool';
// export * from './tools/writeFilesTool';

// Base types should be imported directly from @sylphlab/mcp-core by consumers
// Remove re-export of deleted types.js