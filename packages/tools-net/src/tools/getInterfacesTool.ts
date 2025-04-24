import os from 'node:os';
import { defineTool } from '@sylphlab/tools-core';
import { jsonPart } from '@sylphlab/tools-core';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core';
import { z } from 'zod';
import { GetInterfacesToolInputSchema } from './getInterfacesTool.schema.js';

// --- TypeScript Types ---
export type GetInterfacesToolInput = z.infer<typeof GetInterfacesToolInputSchema>;

// Define a more specific type for the result based on os.networkInterfaces()
export type NetworkInterfaces = { [key: string]: os.NetworkInterfaceInfo[] | undefined };

// --- Output Types ---
export interface GetInterfacesResult {
  /** Optional ID from the input. */
  id?: string;
  /** Whether retrieving interfaces was successful. */
  success: boolean;
  /** The network interfaces object, if successful. */
  result?: NetworkInterfaces;
  /** Error message, if retrieval failed. */
  error?: string;
  /** Suggestion for fixing the error. */
  suggestion?: string;
}

// Zod Schema for the individual result
const GetInterfacesResultSchema = z.object({
  id: z.string().optional(),
  success: z.boolean(),
  // Using z.custom for complex os types, refine if needed
  result: z.custom<NetworkInterfaces>().optional(),
  error: z.string().optional(),
  suggestion: z.string().optional(),
});

// Define the output schema instance as a constant array
const GetInterfacesOutputSchema = z.array(GetInterfacesResultSchema);

// --- Tool Definition using defineTool ---
export const getInterfacesTool = defineTool({
  name: 'getInterfaces',
  description: 'Retrieves details about the network interfaces on the machine.',
  inputSchema: GetInterfacesToolInputSchema,

  execute: async (
    input: GetInterfacesToolInput,
    _options: ToolExecuteOptions,
  ): Promise<Part[]> => {
    // Return Part[]

    // Zod validation (throw error on failure)
    const parsed = GetInterfacesToolInputSchema.safeParse(input);
    if (!parsed.success) {
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      throw new Error(`Input validation failed: ${errorMessages}`);
    }
    const { id } = parsed.data; // Input schema might be empty, handle accordingly

    const results: GetInterfacesResult[] = [];
    let interfaces: NetworkInterfaces | undefined;
    let error: string | undefined;
    let suggestion: string | undefined;
    let success = false;

    try {
      interfaces = os.networkInterfaces();
      if (!interfaces || Object.keys(interfaces).length === 0) {
        // Consider it an error if no interfaces are found, as it's unusual
        throw new Error('No network interfaces found on the system.');
      }
      success = true;
      suggestion = 'Result contains local network interface details.';
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown error retrieving network interfaces';
      suggestion = 'Check system permissions or if network interfaces are available.';
      interfaces = undefined;
    }

    // Push the single result
    results.push({
      id,
      success,
      result: interfaces,
      error,
      suggestion,
    });

    // Return the result wrapped in jsonPart
    return [jsonPart(results, GetInterfacesOutputSchema)];
  },
});

// Export necessary types
