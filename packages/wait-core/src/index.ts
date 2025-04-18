/**
 * Waits for a specified duration.
 * @param ms The number of milliseconds to wait.
 */
async function wait(ms: number): Promise<void> {
  // Add basic validation
  if (typeof ms !== 'number' || ms < 0) {
    console.error('Invalid duration provided to wait function.');
    // Or throw an error, depending on desired behavior
    return;
  }
  console.log(`Waiting for ${ms}ms...`);
  await new Promise(resolve => setTimeout(resolve, ms));
  console.log('Wait finished.');
}

console.log('MCP Wait Core Package Loaded');

export { wait };
