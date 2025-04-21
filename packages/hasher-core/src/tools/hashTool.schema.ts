import { z } from 'zod';
import crypto from 'node:crypto';

// Get available hash algorithms dynamically
const availableAlgorithms = crypto.getHashes();

// Ensure the array is not empty before creating the enum
export const HashAlgorithmEnum = availableAlgorithms.length > 0
  ? z.enum(availableAlgorithms as [string, ...string[]])
  : z.string().refine(() => false, { message: "No hash algorithms available on the system" }); // Fallback if no hashes found


// Schema for a single hash operation item
export const HashItemSchema = z.object({
  id: z.string().optional(),
  algorithm: HashAlgorithmEnum, // Use the enum here
  data: z.string({ required_error: 'Input data must be a string.' }),
});

// Main input schema: an array of hash items
export const hashToolInputSchema = z.object({
  items: z.array(HashItemSchema).min(1, 'At least one hash item is required.'),
});