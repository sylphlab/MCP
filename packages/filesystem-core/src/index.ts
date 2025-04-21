// src/index.ts for @sylphlab/mcp-filesystem-core

// Export available tool implementations and Zod schemas
export { copyItemsTool } from './tools/copyItemsTool.js';
export { copyItemsToolInputSchema } from './tools/copyItemsTool.schema.js';
export { createFolderTool } from './tools/createFolderTool.js';
export { createFolderToolInputSchema } from './tools/createFolderTool.schema.js';
export { deleteItemsTool } from './tools/deleteItemsTool.js';
export { deleteItemsToolInputSchema } from './tools/deleteItemsTool.schema.js';
export { editFileTool } from './tools/editFileTool.js';
export { editFileToolInputSchema } from './tools/editFileTool.schema.js';
export { listFilesTool } from './tools/listFilesTool.js';
export { listFilesToolInputSchema } from './tools/listFilesTool.schema.js';
export { moveRenameItemsTool } from './tools/moveRenameItemsTool.js';
export { moveRenameItemsToolInputSchema } from './tools/moveRenameItemsTool.schema.js';
export { readFilesTool } from './tools/readFilesTool.js';
export { readFilesToolInputSchema } from './tools/readFilesTool.schema.js';
export { replaceContentTool } from './tools/replaceContentTool.js';
export { replaceContentToolInputSchema } from './tools/replaceContentTool.schema.js';
export { searchContentTool } from './tools/searchContentTool.js';
export { searchContentToolInputSchema } from './tools/searchContentTool.schema.js';
export { statItemsTool } from './tools/statItemsTool.js';
export { statItemsToolInputSchema } from './tools/statItemsTool.schema.js';
export { writeFilesTool } from './tools/writeFilesTool.js';
export { writeFilesToolInputSchema } from './tools/writeFilesTool.schema.js';

// Also export inferred types for convenience if needed by consumers
export type { CopyItemsToolInput } from './tools/copyItemsTool.js';
export type { CreateFolderToolInput } from './tools/createFolderTool.js';
export type { DeleteItemsToolInput } from './tools/deleteItemsTool.js';
export type { EditFileToolInput } from './tools/editFileTool.js';
export type { ListFilesToolInput } from './tools/listFilesTool.js';
export type { MoveRenameItemsToolInput } from './tools/moveRenameItemsTool.js';
export type { ReadFilesToolInput } from './tools/readFilesTool.js';
export type { ReplaceContentToolInput } from './tools/replaceContentTool.js';
export type { SearchContentToolInput } from './tools/searchContentTool.js';
export type { StatItemsToolInput } from './tools/statItemsTool.js';
export type { WriteFilesToolInput } from './tools/writeFilesTool.js';

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
