import { z } from 'zod';

// Define allowed operations
export const JsonOperationEnum = z.enum(['parse', 'stringify']);

// Schema for a single JSON operation item
export const JsonInputItemSchema = z
  .object({
    id: z.string().optional(),
    operation: JsonOperationEnum,
    data: z.any(), // Data can be string for parse, any for stringify
  })
  .refine((data) => !(data.operation === 'parse' && typeof data.data !== 'string'), {
    message: 'Input data for "parse" operation must be a string.',
    path: ['data'], // Specify the path of the error
  });

// Main input schema: an array of JSON operation items
export const jsonToolInputSchema = z.object({
  items: z.array(JsonInputItemSchema).min(1, 'At least one JSON operation item is required.'),
});
