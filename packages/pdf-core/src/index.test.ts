import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest'; // Import Mocked type
import { getTextTool, GetTextToolInput } from './index'; // Import the correct tool and input type
import path from 'node:path'; // Import path for resolving
// Import the real function for mocking its module - Assuming validateAndResolvePath is still used and not mocked here
// import { validateAndResolvePath } from '@sylphlab/mcp-core';

// Mock the necessary modules
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// --- Mock mupdf/mupdfjs ---
const mockStructuredTextJson = JSON.stringify({
  blocks: [{
    lines: [{
      spans: [{ text: 'Mock MuPDF text content' }]
    }]
  }]
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
    if (pageNum === 0) { // mupdf is 0-indexed
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


describe('getTextTool.execute', () => { // Update describe block
  const mockFileBuffer = Buffer.from('fake-pdf-content');
  // No need for mockStaticLoadFn anymore
  const WORKSPACE_ROOT = path.resolve('/test/workspace');
  const resolvedValidPath = path.join(WORKSPACE_ROOT, 'test.pdf');
  const resolvedErrorPath = path.join(WORKSPACE_ROOT, 'error.pdf');
  const resolvedOutsidePath = path.resolve('/test', 'outside.pdf');
  const defaultOptions = { allowOutsideWorkspace: false };
  const allowOutsideOptions = { allowOutsideWorkspace: true };


  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // --- Reset mupdf mocks ---
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
    vi.mocked(readFile).mockImplementation(async (filePath: any) => {
        if (filePath === resolvedValidPath || filePath === resolvedOutsidePath) {
            return mockFileBuffer;
        } else if (filePath === resolvedErrorPath) {
             // Simulate ENOENT for error path in the 'multiple operations' test
             const error: any = new Error(`ENOENT`); error.code = 'ENOENT'; throw error;
        } else if (filePath === path.join(WORKSPACE_ROOT, 'nonexistent.pdf')) {
             // Simulate ENOENT for nonexistent path
             const error: any = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
             error.code = 'ENOENT';
             throw error;
        } else if (filePath === path.join(WORKSPACE_ROOT, '')) {
            return mockFileBuffer;
        }
         else {
            // Default throw for unexpected paths
            const error: any = new Error(`ENOENT: unexpected path '${filePath}'`);
            error.code = 'ENOENT';
            throw error;
        }
    });
  });

  afterEach(() => {
    // Restore mocks if necessary, though clearAllMocks in beforeEach is often sufficient
    vi.restoreAllMocks();
  });


  it('should read PDF text', async () => {
    // Note: getTextTool only handles one file, not items array or operations
    const input: GetTextToolInput = { filePath: 'test.pdf' };
    const output = await getTextTool.execute(input, WORKSPACE_ROOT, defaultOptions);

    expect(readFile).toHaveBeenCalledWith(resolvedValidPath);
    // Check mupdf calls
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(mockFileBuffer, "application/pdf");
    expect(mockMuPdfDoc.countPages).toHaveBeenCalled();
    expect(mockMuPdfDoc.loadPage).toHaveBeenCalledWith(0); // mupdf is 0-indexed
    expect(mockMuPdfPage.toStructuredText).toHaveBeenCalledWith("preserve-whitespace");
    expect(mockStructuredText.asJSON).toHaveBeenCalled();
    expect(output.success).toBe(true);
    // getTextTool output is simpler
    expect(output.result).toBe('Mock MuPDF text content'); // Correct property name
    expect(output.error).toBeUndefined();
  });

  it('should handle file read error (ENOENT)', async () => {
    const input: GetTextToolInput = { filePath: 'nonexistent.pdf' };
    const output = await getTextTool.execute(input, WORKSPACE_ROOT, defaultOptions);

    expect(readFile).toHaveBeenCalledWith(path.join(WORKSPACE_ROOT, 'nonexistent.pdf'));
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled(); // Should fail before mupdf call
    expect(output.success).toBe(false);
    expect(output.result).toBeUndefined(); // Correct property name
    expect(output.error).toContain('File not found');
    expect(output.suggestion).toContain('Ensure the file path is correct');
  });

  it('should handle mupdfjs.PDFDocument.openDocument error', async () => {
    // Mock openDocument to throw for this specific test
    const openError = new Error('Mock MuPDF open failed');
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockImplementation(() => { throw openError; });

    const input: GetTextToolInput = { filePath: 'test.pdf' };
    const output = await getTextTool.execute(input, WORKSPACE_ROOT, defaultOptions);

    expect(readFile).toHaveBeenCalledWith(resolvedValidPath);
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(mockFileBuffer, "application/pdf");
    expect(mockMuPdfDoc.countPages).not.toHaveBeenCalled(); // Should fail before counting pages
    expect(output.success).toBe(false);
    expect(output.result).toBeUndefined(); // Correct property name
    expect(output.error).toContain('Mock MuPDF open failed'); // Error message from the mock
    expect(output.suggestion).toContain('valid PDF'); // Suggestion remains similar
  });

  // Removed tests for multiple operations and unsupported operations as getTextTool handles single file/operation

  it('should fail for path outside workspace by default', async () => {
    const input: GetTextToolInput = { filePath: '../outside.pdf' };
    const output = await getTextTool.execute(input, WORKSPACE_ROOT, defaultOptions);
    expect(output.success).toBe(false);
    expect(output.result).toBeUndefined(); // Correct property name
    expect(output.error).toContain('Path validation failed'); // Error comes from validateAndResolvePath
    expect(output.suggestion).toEqual(expect.any(String));
    expect(readFile).not.toHaveBeenCalled();
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled();
  });

  it('should succeed reading PDF outside workspace when allowed', async () => {
    const input: GetTextToolInput = { filePath: '../outside.pdf' };
    const output = await getTextTool.execute(input, WORKSPACE_ROOT, allowOutsideOptions);

    expect(readFile).toHaveBeenCalledWith(resolvedOutsidePath);
    // Check mupdf calls
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(mockFileBuffer, "application/pdf");
    expect(mockMuPdfDoc.countPages).toHaveBeenCalled();
    expect(mockMuPdfDoc.loadPage).toHaveBeenCalledWith(0); // mupdf is 0-indexed
    expect(mockMuPdfPage.toStructuredText).toHaveBeenCalledWith("preserve-whitespace");
    expect(mockStructuredText.asJSON).toHaveBeenCalled();
    expect(output.success).toBe(true);
    expect(output.result).toBe('Mock MuPDF text content'); // Correct property name
    expect(output.error).toBeUndefined();
  });
});