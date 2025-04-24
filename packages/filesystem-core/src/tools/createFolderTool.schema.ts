import { z } from 'zod';

// Main input schema: an array of folder paths
export const createFolderToolInputSchema = z.object({
  folderPaths: z
    .array(z.string().min(1, 'Folder path cannot be empty.'))
    .min(1, 'folderPaths array cannot be empty.'),
  // allowOutsideWorkspace is handled by ToolExecuteOptions, not part of tool input schema
});
