import path from 'node:path'; // Import path for resolving
import type { McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type
import { type Mocked, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'; // Import Mocked type
import { type GetTextToolInput, getTextTool } from './index.js'; // Import the correct tool and input type
import type { GetTextResultItem } from './tools/getTextTool.js'; // Import result item type
// Import the real function for mocking its module - Assuming validateAndResolvePath is still used and not mocked here
// import { validateAndResolvePath } from '@sylphlab/mcp-core';

// Mock the necessary modules
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// --- Mock mupdf/mupdfjs ---
const mockStructuredTextJson = JSON.stringify({
  blocks: [
    {
      lines: [
        {
          spans: [{ text: 'Mock MuPDF text content' }],
        },
      ],
    },
  ],
});

const mockStructuredText = {
  asJSON: vi.fn().mockReturnValue(mockStructuredTextJson),
};

const mockMuPdfPage = {
  toStructuredText: vi.fn().mockReturnValue(mockStructuredText),
  // Add mock for free() or similar if needed for testing cleanup
};

const mockMuPdfDoc = {
  countPages: vi.fn().mockReturnValue(1),
  loadPage: vi.fn().mockImplementation((pageNum) => {
    if (pageNum === 0) {
      // mupdf is 0-indexed
      return mockMuPdfPage;
    }
    throw new Error('Mock: Invalid page number');
  }),
  // Add mock for free() or similar if needed for testing cleanup
};

// Mock the mupdf/mupdfjs module
vi.mock('mupdf/mupdfjs', () => ({
  PDFDocument: {
    openDocument: vi.fn(),
  },
  // Mock other exports if necessary
}));
// --- End Mock mupdf/mupdfjs ---

// Import mocks AFTER vi.mock calls
import { readFile } from 'node:fs/promises';
// Import the mocked mupdf namespace
import * as mupdfjs from 'mupdf/mupdfjs';

describe('getTextTool.execute', () => {
  // Update describe block
  const mockFileBuffer = Buffer.from('fake-pdf-content');
  // No need for mockStaticLoadFn anymore
  const WORKSPACE_ROOT = path.resolve('/test/workspace');
  const resolvedValidPath = path.join(WORKSPACE_ROOT, 'test.pdf');
  const resolvedErrorPath = path.join(WORKSPACE_ROOT, 'error.pdf');
  const resolvedOutsidePath = path.resolve('/test', 'outside.pdf');
  // Define options objects including workspaceRoot
  const defaultOptions: McpToolExecuteOptions = {
    workspaceRoot: WORKSPACE_ROOT,
    allowOutsideWorkspace: false,
  };
  const allowOutsideOptions: McpToolExecuteOptions = {
    workspaceRoot: WORKSPACE_ROOT,
    allowOutsideWorkspace: true,
  };

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // --- Reset mupdf mocks ---
    // biome-ignore lint/suspicious/noExplicitAny: Casting mock object for return value typing
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockReturnValue(mockMuPdfDoc as any); // Cast to any
    vi.mocked(mockMuPdfDoc.countPages).mockReturnValue(1);
    vi.mocked(mockMuPdfDoc.loadPage).mockImplementation((pageNum) => {
      if (pageNum === 0) return mockMuPdfPage; // 0-indexed
      throw new Error('Mock: Invalid page number');
    });
    vi.mocked(mockMuPdfPage.toStructuredText).mockReturnValue(mockStructuredText);
    vi.mocked(mockStructuredText.asJSON).mockReturnValue(mockStructuredTextJson);
    // --- End Reset mupdf mocks ---

    // Setup default mock implementations for other external modules
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter type can be complex
    vi.mocked(readFile).mockImplementation(async (filePath: any) => {
      if (filePath === resolvedValidPath || filePath === resolvedOutsidePath) {
        return mockFileBuffer;
      }
      if (filePath === resolvedErrorPath) {
        // Simulate ENOENT for error path in the 'multiple operations' test
        const error = new Error('ENOENT');
        // biome-ignore lint/suspicious/noExplicitAny: Dynamically adding property for mock error
        (error as any).code = 'ENOENT'; // Add code property dynamically for mock
        throw error;
      }
      if (filePath === path.join(WORKSPACE_ROOT, 'nonexistent.pdf')) {
        // Simulate ENOENT for nonexistent path
        const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        // biome-ignore lint/suspicious/noExplicitAny: Dynamically adding property for mock error
        (error as any).code = 'ENOENT'; // Add code property dynamically for mock
        throw error;
      }
      if (filePath === path.join(WORKSPACE_ROOT, '')) {
        return mockFileBuffer;
      }

      // Default throw for unexpected paths
      const error = new Error(`ENOENT: unexpected path '${filePath}'`);
      // biome-ignore lint/suspicious/noExplicitAny: Dynamically adding property for mock error
      (error as any).code = 'ENOENT'; // Add code property dynamically for mock
      throw error;
    });
  });

  afterEach(() => {
    // Restore mocks if necessary, though clearAllMocks in beforeEach is often sufficient
    vi.restoreAllMocks();
  });

  it('should read PDF text for a single item batch', async () => {
    const input: GetTextToolInput = { items: [{ id: 'pdf1', filePath: 'test.pdf' }] };
    const output = await getTextTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    const itemResult = output.results[0];

    expect(readFile).toHaveBeenCalledWith(resolvedValidPath);
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(
      mockFileBuffer,
      'application/pdf',
    );
    expect(mockMuPdfDoc.countPages).toHaveBeenCalled();
    expect(mockMuPdfDoc.loadPage).toHaveBeenCalledWith(0);
    expect(mockMuPdfPage.toStructuredText).toHaveBeenCalledWith('preserve-whitespace');
    expect(mockStructuredText.asJSON).toHaveBeenCalled();

    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('pdf1');
    expect(itemResult.result).toBe('Mock MuPDF text content');
    expect(itemResult.error).toBeUndefined();
    expect(output.error).toBeUndefined(); // No overall tool error
  });

  it('should handle file read error (ENOENT) for a single item batch', async () => {
    const input: GetTextToolInput = { items: [{ id: 'pdf2', filePath: 'nonexistent.pdf' }] };
    const output = await getTextTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(false); // Overall fails
    expect(output.results).toHaveLength(1);
    const itemResult = output.results[0];

    expect(readFile).toHaveBeenCalledWith(path.join(WORKSPACE_ROOT, 'nonexistent.pdf'));
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled();

    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('pdf2');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('File not found');
    expect(itemResult.suggestion).toContain('Ensure the file path is correct');
  });

  it('should handle mupdfjs.PDFDocument.openDocument error for a single item batch', async () => {
    const openError = new Error('Mock MuPDF open failed');
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockImplementation(() => {
      throw openError;
    });

    const input: GetTextToolInput = { items: [{ id: 'pdf3', filePath: 'test.pdf' }] };
    const output = await getTextTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(false); // Overall fails
    expect(output.results).toHaveLength(1);
    const itemResult = output.results[0];

    expect(readFile).toHaveBeenCalledWith(resolvedValidPath);
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(
      mockFileBuffer,
      'application/pdf',
    );
    expect(mockMuPdfDoc.countPages).not.toHaveBeenCalled();

    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('pdf3');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('Mock MuPDF open failed');
    expect(itemResult.suggestion).toContain('valid PDF');
  });

  it('should fail for path outside workspace by default (single item batch)', async () => {
    const input: GetTextToolInput = { items: [{ id: 'pdf4', filePath: '../outside.pdf' }] };
    const output = await getTextTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(false); // Overall fails
    expect(output.results).toHaveLength(1);
    const itemResult = output.results[0];

    expect(itemResult.success).toBe(false);
    expect(itemResult.id).toBe('pdf4');
    expect(itemResult.result).toBeUndefined();
    expect(itemResult.error).toContain('Path validation failed');
    expect(itemResult.suggestion).toEqual(expect.any(String));

    expect(readFile).not.toHaveBeenCalled();
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled();
  });

  it('should succeed reading PDF outside workspace when allowed (single item batch)', async () => {
    const input: GetTextToolInput = { items: [{ id: 'pdf5', filePath: '../outside.pdf' }] };
    const output = await getTextTool.execute(input, allowOutsideOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    const itemResult = output.results[0];

    expect(readFile).toHaveBeenCalledWith(resolvedOutsidePath);
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(
      mockFileBuffer,
      'application/pdf',
    );
    // ... other mupdf checks ...

    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('pdf5');
    expect(itemResult.result).toBe('Mock MuPDF text content');
    expect(itemResult.error).toBeUndefined();
  });

  it('should process a batch of multiple PDF extractions with mixed results', async () => {
    const input: GetTextToolInput = {
      items: [
        { id: 'batch_ok', filePath: 'test.pdf' }, // Success
        { id: 'batch_enoent', filePath: 'nonexistent.pdf' }, // Fail (ENOENT)
        { id: 'batch_outside_fail', filePath: '../outside.pdf' }, // Fail (Path validation)
        { id: 'batch_outside_ok', filePath: '../outside.pdf' }, // Success (different options needed)
        { id: 'batch_mupdf_err', filePath: 'test.pdf' }, // Fail (MuPDF error)
      ],
    };

    const openError = new Error('Mock MuPDF open failed for batch');
    let openDocCallCounter = 0;
    // Mock openDocument to throw only on the second call within this test scope (for 'batch_mupdf_err')
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockImplementation((_buffer, _type) => {
      openDocCallCounter++;
      // Items 'batch_enoent' and 'batch_outside_fail' fail before openDocument is called.
      // So, the 1st call is for 'batch_ok', the 2nd is for 'batch_mupdf_err'.
      if (openDocCallCounter === 2) {
        throw openError;
      }
      // biome-ignore lint/suspicious/noExplicitAny: Casting mock object for return value typing
      return mockMuPdfDoc as any; // Succeed for the first call
    });

    // Execute with default options first
    const outputDefault = await getTextTool.execute(input, defaultOptions); // Pass options object

    expect(outputDefault.success).toBe(false); // Overall fails because some items fail
    expect(outputDefault.results).toHaveLength(5);
    expect(outputDefault.error).toBeUndefined();

    // Restore default mock behavior (always succeed) for the next call
    openDocCallCounter = 0; // Reset counter just in case
    // biome-ignore lint/suspicious/noExplicitAny: Casting mock object for return value typing
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockReturnValue(mockMuPdfDoc as any);

    // Re-execute the specific item that needs different options ('batch_outside_ok')
    const outsideOkInput: GetTextToolInput = {
      items: [{ id: 'batch_outside_ok', filePath: '../outside.pdf' }],
    };
    const outputOutsideOk = await getTextTool.execute(outsideOkInput, allowOutsideOptions); // Pass options object

    // --- Assertions for outputDefault ---
    const resOk = outputDefault.results.find((r: GetTextResultItem) => r.id === 'batch_ok');
    expect(resOk?.success).toBe(true);
    expect(resOk?.result).toBe('Mock MuPDF text content');

    const resEnoent = outputDefault.results.find((r: GetTextResultItem) => r.id === 'batch_enoent');
    expect(resEnoent?.success).toBe(false);
    expect(resEnoent?.error).toContain('File not found');

    const resOutsideFail = outputDefault.results.find(
      (r: GetTextResultItem) => r.id === 'batch_outside_fail',
    );
    expect(resOutsideFail?.success).toBe(false);
    expect(resOutsideFail?.error).toContain('Path validation failed');

    // Note: batch_outside_ok would have failed path validation in outputDefault run

    const resMupdfErr = outputDefault.results.find(
      (r: GetTextResultItem) => r.id === 'batch_mupdf_err',
    );
    expect(resMupdfErr?.success).toBe(false);
    expect(resMupdfErr?.error).toContain('Mock MuPDF open failed for batch');

    // --- Assertions for outputOutsideOk ---
    expect(outputOutsideOk.success).toBe(true);
    expect(outputOutsideOk.results).toHaveLength(1);
    const resOutsideOk = outputOutsideOk.results[0];
    expect(resOutsideOk?.success).toBe(true);
    expect(resOutsideOk?.id).toBe('batch_outside_ok');
    expect(resOutsideOk?.result).toBe('Mock MuPDF text content');

    // Restore original mock after test
    // Restore default mock behavior after test
    // biome-ignore lint/suspicious/noExplicitAny: Casting mock object for return value typing
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockReturnValue(mockMuPdfDoc as any);
  });
});
