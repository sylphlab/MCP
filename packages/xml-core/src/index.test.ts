import type { Part } from '@sylphlab/mcp-core'; // Import Part type
import { describe, expect, it } from 'vitest';
// Import the actual tool and its types
import { type XmlToolInput, xmlTool } from './index.js'; // Use .js extension for consistency
import type { XmlResultItem } from './tools/xmlTool.js';

// Mock workspace root - not used by this tool's logic but required by execute signature
const mockWorkspaceRoot = '';

// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  // console.log('DEBUG: getJsonResult received parts:', JSON.stringify(parts, null, 2)); // Keep commented for now
  const jsonPart = parts.find((part) => part.type === 'json');
  // console.log('DEBUG: Found jsonPart:', JSON.stringify(jsonPart, null, 2)); // Keep commented for now
  // Check if jsonPart exists and has a 'value' property (which holds the actual data)
  if (jsonPart && jsonPart.value !== undefined) {
    // console.log('DEBUG: typeof jsonPart.value:', typeof jsonPart.value); // Keep commented for now
    // console.log('DEBUG: Attempting to use jsonPart.value directly'); // Keep commented for now
    try {
      // Assuming the value is already the correct array type based on defineTool's outputSchema
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  // console.log('DEBUG: jsonPart or jsonPart.value is undefined or null.'); // Keep commented for now
  return undefined;
}

describe('xmlTool.execute', () => {
  // Note: The current xmlTool is a placeholder and doesn't actually parse XML.
  // Tests reflect the placeholder behavior.

  it('should simulate parsing valid XML string (single item batch)', async () => {
    const input: XmlToolInput = {
      items: [{ id: 'a', operation: 'parse', data: '<tag>value</tag>' }],
    };
    const parts = await xmlTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('a');
    expect(itemResult.result).toEqual({ simulated: 'parsed_data_for_a' }); // Matches placeholder
    expect(itemResult.error).toBeUndefined();
  });

  it('should simulate returning error for invalid XML string (single item batch)', async () => {
    // Placeholder logic checks for '<error>' substring
    const input: XmlToolInput = {
      items: [{ id: 'b', operation: 'parse', data: '<error>invalid</error>' }],
    };
    const parts = await xmlTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('b');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('Simulated XML parse error');
    expect(itemResult.suggestion).toBe('Ensure input is valid XML. Check for syntax errors.');
  });

  it('should process a batch of XML parse operations (simulated)', async () => {
    const input: XmlToolInput = {
      items: [
        { id: 'xml_ok1', operation: 'parse', data: '<ok>1</ok>' },
        { id: 'xml_err', operation: 'parse', data: '<contains><error/></contains>' },
        { id: 'xml_ok2', operation: 'parse', data: '<ok>2</ok>' },
      ],
    };
    const parts = await xmlTool.execute(input, { workspaceRoot: mockWorkspaceRoot });
    const results = getJsonResult(parts);

    expect(results).toBeDefined();
    expect(results).toHaveLength(3);

    // Check success cases
    const resOk1 = results?.find((r) => r.id === 'xml_ok1');
    expect(resOk1?.success).toBe(true);
    expect(resOk1?.result).toEqual({ simulated: 'parsed_data_for_xml_ok1' });
    expect(resOk1?.error).toBeUndefined();

    const resOk2 = results?.find((r) => r.id === 'xml_ok2');
    expect(resOk2?.success).toBe(true);
    expect(resOk2?.result).toEqual({ simulated: 'parsed_data_for_xml_ok2' });
    expect(resOk2?.error).toBeUndefined();

    // Check error case
    const resErr = results?.find((r) => r.id === 'xml_err');
    expect(resErr?.success).toBe(false);
    expect(resErr?.result).toBeUndefined();
    expect(resErr?.error).toContain('Simulated XML parse error');
    expect(resErr?.suggestion).toBe('Ensure input is valid XML. Check for syntax errors.');
  });
});
