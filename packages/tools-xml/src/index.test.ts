import type { Part, ToolExecuteOptions } from '@sylphlab/tools-core'; // Import Part type and ToolExecuteOptions
import { describe, expect, it } from 'vitest';
// Import the actual tool and its types
import { type XmlToolInput, xmlTool } from './index.js'; // Use .js extension for consistency
import type { XmlResultItem } from './tools/xmlTool.js';
import { BaseContextSchema } from '@sylphlab/tools-core'; // Import BaseContextSchema

// Mock workspace root - not used by this tool's logic but required by execute signature
const mockContext: ToolExecuteOptions = { workspaceRoot: '' }; // Use mock context

// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  const jsonPart = parts.find((part): part is Part & { type: 'json' } => part.type === 'json'); // Type predicate
  // Check if jsonPart exists and has a 'value' property (which holds the actual data)
  if (jsonPart && jsonPart.value !== undefined) {
    try {
      // Assuming the value is already the correct array type based on defineTool's outputSchema
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  return undefined;
}

describe('xmlTool.execute', () => {
  // Note: The current xmlTool is a placeholder and doesn't actually parse XML.
  // Tests reflect the placeholder behavior.

  it('should simulate parsing valid XML string (single item batch)', async () => {
    const args: XmlToolInput = { // Rename to args
      items: [{ id: 'a', operation: 'parse', data: '<tag>value</tag>' }],
    };
    const parts = await xmlTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<XmlResultItem>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('a');
    expect(itemResult.result).toEqual({ simulated: 'parsed_data_for_a' }); // Matches placeholder
    expect(itemResult.error).toBeUndefined();
  });

  it('should simulate returning error for invalid XML string (single item batch)', async () => {
    // Placeholder logic checks for '<error>' substring
    const args: XmlToolInput = { // Rename to args
      items: [{ id: 'b', operation: 'parse', data: '<error>invalid</error>' }],
    };
    const parts = await xmlTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<XmlResultItem>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard
    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('b');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('Simulated XML parse error');
    expect(itemResult.suggestion).toBe('Ensure input is valid XML. Check for syntax errors.');
  });

  it('should process a batch of XML parse operations (simulated)', async () => {
    const args: XmlToolInput = { // Rename to args
      items: [
        { id: 'xml_ok1', operation: 'parse', data: '<ok>1</ok>' },
        { id: 'xml_err', operation: 'parse', data: '<contains><error/></contains>' },
        { id: 'xml_ok2', operation: 'parse', data: '<ok>2</ok>' },
      ],
    };
    const parts = await xmlTool.execute({ context: mockContext, args }); // Use new signature
    const results = getJsonResult<XmlResultItem>(parts); // Specify type

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
