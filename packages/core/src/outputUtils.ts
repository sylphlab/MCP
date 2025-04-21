import type { BaseMcpToolOutput, McpContentPart } from './index'; // Import types locally from core

const DEFAULT_OUTPUT_CHAR_LIMIT = 20000; // Default character limit for tool output

/**
 * Checks if the tool output exceeds a specified character limit.
 * Currently calculates based on the length of 'text' in TextPart items.
 *
 * @param result The original tool output.
 * @param options Optional configuration containing maxOutputChars.
 * @returns The original result if within limit, or a new error result if exceeded.
 */
export function checkOutputSizeLimit(
  result: BaseMcpToolOutput,
  options?: { maxOutputChars?: number },
): BaseMcpToolOutput {
  // If the tool already failed, return the original error result
  if (!result.success) {
    return result;
  }

  const limit = options?.maxOutputChars ?? DEFAULT_OUTPUT_CHAR_LIMIT;

  let totalChars = 0;
  if (result.content) {
    for (const part of result.content) {
      if (part.type === 'text') {
        totalChars += part.text.length;
      }
      // Future enhancement: Consider length of other part types (e.g., blob length)
    }
  }

  if (totalChars > limit) {
    const errorMsg = `Tool output exceeded character limit (${totalChars}/${limit}). Output truncated.`;
    // Return a new error result, indicating failure due to size limit
    return {
      success: false,
      error: errorMsg,
      content: [{ type: 'text', text: errorMsg }], // Provide error message in content
    };
  }

  // If within limit, return the original result
  return result;
}