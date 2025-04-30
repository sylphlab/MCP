import path from 'node:path';
import type { ToolExecuteOptions, Part } from '@sylphlab/tools-core'; // Import Part type
import { type Mocked, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GetTextToolInput, getTextTool } from './index.js';
import type { GetTextResultItem } from './tools/getTextTool.js'; // Import correct result type

// Mock the necessary modules
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// --- Mock mupdf/mupdfjs ---
const mockMuPdfPage = {
  getText: vi.fn().mockReturnValue('Mock MuPDF text content'),
  destroy: vi.fn(), // Add destroy mock
};

const mockMuPdfDoc = {
  countPages: vi.fn().mockReturnValue(1),
  loadPage: vi.fn().mockImplementation((pageNum) => {
    if (pageNum === 0) {
      return mockMuPdfPage;
    }
    throw new Error('Mock: Invalid page number');
  }),
  destroy: vi.fn(), // Add destroy mock
};

vi.mock('mupdf/mupdfjs', () => ({
  PDFDocument: {
    openDocument: vi.fn(),
  },
}));
// --- End Mock mupdf/mupdfjs ---

// Import mocks AFTER vi.mock calls
import { readFile } from 'node:fs/promises';
import * as mupdfjs from 'mupdf/mupdfjs';

// Helper to extract JSON result from parts
// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  const jsonPart = parts.find((part): part is Part & { type: 'json' } => part.type === 'json'); // Type predicate
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
describe('getTextTool.execute', () => {
  const mockFileBuffer = Buffer.from('fake-pdf-content');
  const WORKSPACE_ROOT = path.resolve('/test/workspace');
  const resolvedValidPath = path.join(WORKSPACE_ROOT, 'test.pdf');
  const resolvedErrorPath = path.join(WORKSPACE_ROOT, 'error.pdf'); // Used in batch test
  const resolvedOutsidePath = path.resolve('/test', 'outside.pdf');
  const defaultOptions: ToolExecuteOptions = {
    workspaceRoot: WORKSPACE_ROOT,
    allowOutsideWorkspace: false,
  };
  const allowOutsideOptions: ToolExecuteOptions = {
    workspaceRoot: WORKSPACE_ROOT,
    allowOutsideWorkspace: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mupdf mocks
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockReturnValue(mockMuPdfDoc as any);
    vi.mocked(mockMuPdfDoc.countPages).mockReturnValue(1);
    vi.mocked(mockMuPdfDoc.loadPage).mockImplementation((pageNum) => {
      if (pageNum === 0) return mockMuPdfPage;
      throw new Error('Mock: Invalid page number');
    });
    vi.mocked(mockMuPdfPage.getText).mockReturnValue('Mock MuPDF text content');
    vi.mocked(mockMuPdfPage.destroy).mockClear(); // Clear destroy calls
    vi.mocked(mockMuPdfDoc.destroy).mockClear(); // Clear destroy calls

    // Setup default mock implementations for readFile
    vi.mocked(readFile).mockImplementation(async (filePath: any) => {
      if (filePath === resolvedValidPath || filePath === resolvedOutsidePath) {
        return mockFileBuffer;
      }
      if (filePath === resolvedErrorPath) {
        // For batch test error case
        const error = new Error('ENOENT');
        (error as any).code = 'ENOENT';
        throw error;
      }
      if (filePath === path.join(WORKSPACE_ROOT, 'nonexistent.pdf')) {
        const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        (error as any).code = 'ENOENT';
        throw error;
      }
      // Default throw for unexpected paths
      const error = new Error(`ENOENT: unexpected path '${filePath}'`);
      (error as any).code = 'ENOENT';
      throw error;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should read PDF text for a single item batch', async () => {
    const args: GetTextToolInput = { items: [{ id: 'pdf1', filePath: 'test.pdf' }] }; // Rename to args
    // Use new signature
    const parts = await getTextTool.execute({ context: defaultOptions, args });
    const results = getJsonResult<GetTextResultItem>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard

    expect(readFile).toHaveBeenCalledWith(resolvedValidPath);
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(
      mockFileBuffer,
      'application/pdf',
    );
    expect(mockMuPdfDoc.countPages).toHaveBeenCalled();
    expect(mockMuPdfDoc.loadPage).toHaveBeenCalledWith(0);
    expect(mockMuPdfPage.getText).toHaveBeenCalled();
    expect(mockMuPdfPage.destroy).toHaveBeenCalled(); // Check cleanup
    expect(mockMuPdfDoc.destroy).toHaveBeenCalled(); // Check cleanup

    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('pdf1');
    expect(itemResult.path).toBe('test.pdf');
    expect(itemResult.result).toBe('Mock MuPDF text content');
    expect(itemResult.error).toBeUndefined();
  });

  it('should handle file read error (ENOENT) for a single item batch', async () => {
    const args: GetTextToolInput = { items: [{ id: 'pdf2', filePath: 'nonexistent.pdf' }] }; // Rename to args
    const parts = await getTextTool.execute({ context: defaultOptions, args }); // Use new signature
    const results = getJsonResult<GetTextResultItem>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard

    expect(readFile).toHaveBeenCalledWith(path.join(WORKSPACE_ROOT, 'nonexistent.pdf'));
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled();

    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('pdf2');
    expect(itemResult.path).toBe('nonexistent.pdf');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('Failed to get text from PDF');
    expect(itemResult.error).toContain('ENOENT');
    expect(itemResult.suggestion).toContain('Ensure the file path is correct');
  });

  it('should handle mupdfjs.PDFDocument.openDocument error for a single item batch', async () => {
    const openError = new Error('Mock MuPDF open failed');
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockImplementation(() => {
      throw openError;
    });

    const args: GetTextToolInput = { items: [{ id: 'pdf3', filePath: 'test.pdf' }] }; // Rename to args
    const parts = await getTextTool.execute({ context: defaultOptions, args }); // Use new signature
    const results = getJsonResult<GetTextResultItem>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard

    expect(readFile).toHaveBeenCalledWith(resolvedValidPath);
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(
      mockFileBuffer,
      'application/pdf',
    );
    expect(mockMuPdfDoc.countPages).not.toHaveBeenCalled(); // Fails before counting pages

    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('pdf3');
    expect(itemResult.path).toBe('test.pdf');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('Mock MuPDF open failed');
    expect(itemResult.suggestion).toBe('Ensure the file is a valid, uncorrupted PDF document.');
    expect(mockMuPdfDoc.destroy).not.toHaveBeenCalled(); // Should not be called if open failed
  });

  it('should fail for path outside workspace by default (single item batch)', async () => {
    const args: GetTextToolInput = { items: [{ id: 'pdf4', filePath: '../outside.pdf' }] }; // Rename to args
    const parts = await getTextTool.execute({ context: defaultOptions, args }); // Use new signature
    const results = getJsonResult<GetTextResultItem>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard

    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('pdf4');
    expect(itemResult.path).toBe('../outside.pdf');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));

    expect(readFile).not.toHaveBeenCalled();
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled();
  });

  it('should succeed reading PDF outside workspace when allowed (single item batch)', async () => {
    const args: GetTextToolInput = { items: [{ id: 'pdf5', filePath: '../outside.pdf' }] }; // Rename to args
    const parts = await getTextTool.execute({ context: allowOutsideOptions, args }); // Use new signature
    const results = getJsonResult<GetTextResultItem>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0];
    expect(itemResult).toBeDefined(); // Add check
    if (!itemResult) return; // Type guard

    expect(readFile).toHaveBeenCalledWith(resolvedOutsidePath);
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(
      mockFileBuffer,
      'application/pdf',
    );
    expect(mockMuPdfPage.getText).toHaveBeenCalled();
    expect(mockMuPdfPage.destroy).toHaveBeenCalled();
    expect(mockMuPdfDoc.destroy).toHaveBeenCalled();

    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('pdf5');
    expect(itemResult.path).toBe('../outside.pdf');
    expect(itemResult.result).toBe('Mock MuPDF text content');
    expect(itemResult.error).toBeUndefined();
  });

  it('should process a batch of multiple PDF extractions with mixed results', async () => {
    const args: GetTextToolInput = { // Rename to args
      items: [
        { id: 'batch_ok', filePath: 'test.pdf' }, // Success
        { id: 'batch_enoent', filePath: 'error.pdf' }, // Fail (ENOENT - mocked for this path)
        { id: 'batch_outside_fail', filePath: '../outside.pdf' }, // Fail (Path validation)
        { id: 'batch_mupdf_err', filePath: 'test.pdf' }, // Fail (MuPDF error)
      ],
    };

    const openError = new Error('Mock MuPDF open failed for batch');
    let openDocCallCounter = 0;
    // Mock openDocument to throw only on the second valid call ('batch_mupdf_err')
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockImplementation((_buffer, _type) => {
      openDocCallCounter++;
      // 1st call: batch_ok (success)
      // 2nd call: batch_mupdf_err (fail)
      if (openDocCallCounter === 2) {
        throw openError;
      }
      return mockMuPdfDoc as any;
    });

    const parts = await getTextTool.execute({ context: defaultOptions, args }); // Use new signature
    const results = getJsonResult<GetTextResultItem>(parts); // Specify type

    expect(results).toBeDefined();
    expect(results).toHaveLength(4); // One result object per input item

    // Check batch_ok (Success)
    const resOk = results?.find((r) => r.id === 'batch_ok');
    expect(resOk?.success).toBe(true);
    expect(resOk?.path).toBe('test.pdf');
    expect(resOk?.result).toBe('Mock MuPDF text content');
    expect(resOk?.error).toBeUndefined();

    // Check batch_enoent (Fail - File Read)
    const resEnoent = results?.find((r) => r.id === 'batch_enoent');
    expect(resEnoent?.success).toBe(false);
    expect(resEnoent?.path).toBe('error.pdf');
    expect(resEnoent?.result).toBeUndefined();
    expect(resEnoent?.error).toContain('ENOENT');
    expect(resEnoent?.suggestion).toContain('Ensure the file path is correct');

    // Check batch_outside_fail (Fail - Path Validation)
    const resOutsideFail = results?.find((r) => r.id === 'batch_outside_fail');
    expect(resOutsideFail?.success).toBe(false);
    expect(resOutsideFail?.path).toBe('../outside.pdf');
    expect(resOutsideFail?.result).toBeUndefined();
    expect(resOutsideFail?.error).toContain('Path validation failed');

    // Check batch_mupdf_err (Fail - MuPDF Error)
    const resMupdfErr = results?.find((r) => r.id === 'batch_mupdf_err');
    expect(resMupdfErr?.success).toBe(false);
    expect(resMupdfErr?.path).toBe('test.pdf');
    expect(resMupdfErr?.result).toBeUndefined();
    expect(resMupdfErr?.error).toContain('Mock MuPDF open failed for batch');
    expect(resMupdfErr?.suggestion).toBe('Ensure the file is a valid, uncorrupted PDF document.');

    // Verify mock calls
    expect(readFile).toHaveBeenCalledTimes(3); // ok, enoent, mupdf_err (outside fails before read)
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledTimes(2); // ok, mupdf_err
  });
});
