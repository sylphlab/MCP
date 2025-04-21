import { z } from 'zod';

// --- Zod Schemas for Edit Operations ---

const InsertOperationSchema = z.object({
  operation: z.literal('insert'),
  start_line: z.number().int().min(1, 'start_line must be 1 or greater.'),
  content: z.string(),
});

const DeleteLinesOperationSchema = z
  .object({
    operation: z.literal('delete_lines'),
    start_line: z.number().int().min(1, 'start_line must be 1 or greater.'),
    end_line: z.number().int().min(1, 'end_line must be 1 or greater.'),
  })
  .refine((data) => data.end_line >= data.start_line, {
    message: 'end_line must be greater than or equal to start_line',
    path: ['end_line'], // Specify the path of the error
  });

const ReplaceLinesOperationSchema = z
  .object({
    operation: z.literal('replace_lines'),
    start_line: z.number().int().min(1, 'start_line must be 1 or greater.'),
    end_line: z.number().int().min(1, 'end_line must be 1 or greater.'),
    content: z.string(),
  })
  .refine((data) => data.end_line >= data.start_line, {
    message: 'end_line must be greater than or equal to start_line',
    path: ['end_line'], // Specify the path of the error
  });

const SearchReplaceTextOperationSchema = z
  .object({
    operation: z.literal('search_replace_text'),
    search: z.string().min(1, 'Search string cannot be empty.'),
    replace: z.string(),
    start_line: z.number().int().min(1, 'start_line must be 1 or greater.').optional(),
    end_line: z.number().int().min(1, 'end_line must be 1 or greater.').optional(),
  })
  .refine(
    (data) =>
      data.end_line === undefined ||
      data.start_line === undefined ||
      data.end_line >= data.start_line,
    {
      message: 'end_line must be greater than or equal to start_line',
      path: ['end_line'],
    },
  );

const SearchReplaceRegexOperationSchema = z
  .object({
    operation: z.literal('search_replace_regex'),
    regex: z.string().min(1, 'Regex pattern cannot be empty.'),
    replace: z.string(),
    flags: z.string().optional(),
    start_line: z.number().int().min(1, 'start_line must be 1 or greater.').optional(),
    end_line: z.number().int().min(1, 'end_line must be 1 or greater.').optional(),
  })
  .refine(
    (data) =>
      data.end_line === undefined ||
      data.start_line === undefined ||
      data.end_line >= data.start_line,
    {
      message: 'end_line must be greater than or equal to start_line',
      path: ['end_line'],
    },
  );

// Union of all possible edit operations
export const EditOperationSchema = z.union([
  InsertOperationSchema,
  DeleteLinesOperationSchema,
  ReplaceLinesOperationSchema,
  SearchReplaceTextOperationSchema,
  SearchReplaceRegexOperationSchema,
]);

// Schema for a single file change request
export const FileChangeSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty.'),
  edits: z.array(EditOperationSchema).min(1, 'At least one edit operation is required.'),
});

// Main input schema: an array of file changes
export const editFileToolInputSchema = z.object({
  changes: z.array(FileChangeSchema).min(1, 'At least one file change is required.'),
  // allowOutsideWorkspace is handled by McpToolExecuteOptions
});
