/**
 * Waits for a specified duration.
 * @param ms The number of milliseconds to wait.
 */
async function wait(ms: number): Promise<void> {
  console.log(`Waiting for ${ms}ms...`);
  await new Promise(resolve => setTimeout(resolve, ms));
  console.log('Wait finished.');
}

// Placeholder for potential MCP tool definition
// export const waitTool = ...;

console.log('MCP Wait Tool Package Loaded');

export { wait }; // Exporting the function for potential direct use or testing
