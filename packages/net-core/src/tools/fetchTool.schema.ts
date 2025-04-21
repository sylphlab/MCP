import { z } from 'zod';

// Define allowed HTTP methods
const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);

// Define allowed response types
const ResponseTypeSchema = z.enum(['text', 'json', 'ignore']);

// Schema for a single fetch item
export const FetchItemSchema = z.object({
  id: z.string().optional(),
  url: z.string().url('Invalid URL format.'),
  method: HttpMethodSchema.default('GET'),
  headers: z.record(z.string()).optional(), // Record<string, string>
  body: z.string().optional(), // Body is expected as a string
  responseType: ResponseTypeSchema.default('text'),
});

// Main input schema: an array of fetch items
export const fetchToolInputSchema = z.object({
  items: z.array(FetchItemSchema).min(1, 'At least one fetch item is required.'),
});
