import { z } from 'zod';

// Define allowed operations
export const XmlOperationEnum = z.enum(['parse', 'stringify']);

// Schema for a single XML operation item
export const XmlInputItemSchema = z.object({
  id: z.string().optional(),
  operation: XmlOperationEnum,
  data: z.any(), // Data can be string for parse, object for stringify
  // Add options for stringify (e.g., indentation, rootName) later if needed
}).refine(data => !(data.operation === 'parse' && typeof data.data !== 'string'), {
  message: 'Input data for "parse" operation must be a string.',
  path: ['data'], // Specify the path of the error
});

// Main input schema: an array of XML operation items
export const xmlToolInputSchema = z.object({
  items: z.array(XmlInputItemSchema).min(1, 'At least one XML operation item is required.'),
});