import os from 'node:os'; // For networkInterfaces

// Define Input and Output structures for batch processing
type NetOperation = 'getPublicIp' | 'getInterfaces'; // Add more as needed

interface NetInputItem {
  id?: string; // Optional identifier for correlating results
  operation: NetOperation;
  // Add operation-specific parameters if needed, e.g.:
  // targetHost?: string;
}

interface NetResultItem {
  id?: string; // Corresponds to input id if provided
  success: boolean;
  result?: any; // Operation-specific result (e.g., IP string, interface object)
  error?: string;
  suggestion?: string;
}

/**
 * Processes multiple network operations.
 * @param items An array of NetInputItem objects.
 * @returns A promise resolving to an array of NetResultItem objects.
 */
export async function processNetOperations(items: NetInputItem[]): Promise<NetResultItem[]> {
  const results: NetResultItem[] = [];

  // Example: Fetch public IP once if requested by any item
  const needsPublicIp = items.some(item => item.operation === 'getPublicIp');
  let publicIp: string | null = null;
  let publicIpError: string | null = null;
  if (needsPublicIp) {
    try {
      console.log('Fetching public IP...');
      // Actual fetch using global fetch (mockable in tests)
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      publicIp = data.ip;
      // await new Promise(resolve => setTimeout(resolve, 50)); // Remove simulation
      // publicIp = '8.8.8.8'; // Remove placeholder
      console.log('Public IP fetched.');
    } catch (e: any) {
      console.error(`Failed to fetch public IP: ${e.message}`);
      publicIpError = `Failed to fetch public IP: ${e.message}`;
    }
  }

  for (const item of items) {
    const { id, operation } = item;
    const resultItem: NetResultItem = { id, success: false };

    try {
      switch (operation) {
        case 'getPublicIp':
          if (publicIpError) {
            throw new Error(publicIpError);
          }
          if (publicIp) {
            resultItem.result = publicIp;
            resultItem.success = true;
          } else {
             throw new Error('Public IP was not fetched successfully.');
          }
          break;

        case 'getInterfaces':
          console.log(`Getting network interfaces... (ID: ${id ?? 'N/A'})`);
          resultItem.result = os.networkInterfaces();
          resultItem.success = true;
          console.log(`Network interfaces retrieved. (ID: ${id ?? 'N/A'})`);
          break;

        default:
          // Enforce exhaustiveness check with a utility function or similar
          // const _exhaustiveCheck: never = operation;
          throw new Error(`Unsupported network operation: ${operation}`);
      }
    } catch (e: any) {
      resultItem.error = `Operation '${operation}' failed: ${e.message}`;
      resultItem.suggestion = `Check operation parameters or system network state. For public IP, check internet connection.`;
      if (operation === 'getPublicIp' && !publicIpError) {
         resultItem.suggestion += ' The public IP might not have been requested or fetched successfully earlier.';
      }
    }
    results.push(resultItem);
  }

  return results;
}


console.log('MCP Net Core Package Loaded');

export type { NetInputItem, NetResultItem, NetOperation };
