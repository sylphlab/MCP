// src/index.ts for @sylphlab/mcp-filesystem-core

// Export available tool implementations and Zod schemas
export { copyItemsTool, CopyItemsToolInputSchema } from './tools/copyItemsTool.js';
export { createFolderTool, CreateFolderToolInputSchema } from './tools/createFolderTool.js';
export { deleteItemsTool, DeleteItemsToolInputSchema } from './tools/deleteItemsTool.js';
export { editFileTool, EditFileToolInputSchema } from './tools/editFileTool.js'; // Exporting the schema constant
export { listFilesTool, ListFilesToolInputSchema } from './tools/listFilesTool.js';
export { moveRenameItemsTool, MoveRenameItemsToolInputSchema } from './tools/moveRenameItemsTool.js';
export { readFilesTool, ReadFilesToolInputSchema } from './tools/readFilesTool.js';
export { replaceContentTool, ReplaceContentToolInputSchema } from './tools/replaceContentTool.js';
export { searchContentTool, SearchContentToolInputSchema } from './tools/searchContentTool.js';
export { statItemsTool, StatItemsToolInputSchema } from './tools/statItemsTool.js';
export { writeFilesTool, WriteFilesToolInputSchema } from './tools/writeFilesTool.js';

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