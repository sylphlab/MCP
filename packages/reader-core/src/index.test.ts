import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest'; // Import Mocked type
import { readerTool, ReaderInputItem, ReaderToolInput } from './index'; // Import the tool and input type
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


describe('readerTool.execute', () => {
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
    const input: ReaderToolInput = { items: [{ id: 'a', operation: 'readPdfText', filePath: 'test.pdf' }] };
    const output = await readerTool.execute(input, WORKSPACE_ROOT, defaultOptions);

    expect(readFile).toHaveBeenCalledWith(resolvedValidPath);
    // Check mupdf calls
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(mockFileBuffer, "application/pdf");
    expect(mockMuPdfDoc.countPages).toHaveBeenCalled();
    expect(mockMuPdfDoc.loadPage).toHaveBeenCalledWith(0); // mupdf is 0-indexed
    expect(mockMuPdfPage.toStructuredText).toHaveBeenCalledWith("preserve-whitespace");
    expect(mockStructuredText.asJSON).toHaveBeenCalled();
    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toEqual({
      id: 'a',
      success: true,
      result: 'Mock MuPDF text content', // Expected text from mockStructuredTextJson
    });
  });

  it('should handle file read error (ENOENT)', async () => {
    const input: ReaderToolInput = { items: [{ id: 'b', operation: 'readPdfText', filePath: 'nonexistent.pdf' }] };
    const output = await readerTool.execute(input, WORKSPACE_ROOT, defaultOptions);

    expect(readFile).toHaveBeenCalledWith(path.join(WORKSPACE_ROOT, 'nonexistent.pdf'));
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled(); // Should fail before mupdf call
    expect(output.success).toBe(false); // Overall success should be false
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toEqual(expect.objectContaining({
      id: 'b',
      success: false,
      error: expect.stringContaining('File not found'),
      suggestion: expect.stringContaining('Ensure the file path is correct'),
    }));
  });

  it('should handle mupdfjs.PDFDocument.openDocument error', async () => {
    // Mock openDocument to throw for this specific test
    const openError = new Error('Mock MuPDF open failed');
    vi.mocked(mupdfjs.PDFDocument.openDocument).mockImplementation(() => { throw openError; });

    const input: ReaderToolInput = { items: [{ id: 'c', operation: 'readPdfText', filePath: 'test.pdf' }] };
    const output = await readerTool.execute(input, WORKSPACE_ROOT, defaultOptions);

    expect(readFile).toHaveBeenCalledWith(resolvedValidPath);
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(mockFileBuffer, "application/pdf");
    expect(mockMuPdfDoc.countPages).not.toHaveBeenCalled(); // Should fail before counting pages
    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toEqual(expect.objectContaining({
      id: 'c',
      success: false,
      error: expect.stringContaining('Mock MuPDF open failed'), // Error message from the mock
      suggestion: expect.stringContaining('valid PDF'), // Suggestion remains similar
    }));
  });

   it('should handle multiple operations with mixed results', async () => {
     // readFile mock is now handled in beforeEach for specific paths

     // Ensure mupdf mocks are reset (beforeEach should cover this, but explicit reset is safer if needed)
     vi.mocked(mupdfjs.PDFDocument.openDocument).mockReturnValue(mockMuPdfDoc as any); // Cast to any
     vi.mocked(mockMuPdfDoc.countPages).mockReturnValue(1);
     vi.mocked(mockMuPdfDoc.loadPage).mockReturnValue(mockMuPdfPage);
     vi.mocked(mockMuPdfPage.toStructuredText).mockReturnValue(mockStructuredText);
     vi.mocked(mockStructuredText.asJSON).mockReturnValue(mockStructuredTextJson);


    const items: ReaderInputItem[] = [
      { id: 'd', operation: 'readPdfText', filePath: 'test.pdf' }, // Success
      { id: 'e', operation: 'readPdfText', filePath: 'error.pdf' }, // readFile error
      { id: 'f', operation: 'readPdfText', filePath: 'test.pdf' }, // Success
    ];
    const input: ReaderToolInput = { items };
    const output = await readerTool.execute(input, WORKSPACE_ROOT, defaultOptions);

    expect(output.success).toBe(false); // Because one item failed
    expect(output.results).toHaveLength(3);
    // Check calls - readFile for success/error, openDocument only for success
    expect(readFile).toHaveBeenCalledWith(resolvedValidPath); // Called for 'd' and 'f'
    expect(readFile).toHaveBeenCalledWith(resolvedErrorPath); // Called for 'e'
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledTimes(2); // Called for 'd' and 'f'

    // Check results
    expect(output.results[0]).toEqual(expect.objectContaining({ id: 'd', success: true, result: 'Mock MuPDF text content' }));
    expect(output.results[1]).toEqual(expect.objectContaining({ id: 'e', success: false, error: expect.stringContaining('File not found') }));
    expect(output.results[2]).toEqual(expect.objectContaining({ id: 'f', success: true, result: 'Mock MuPDF text content' }));
  });

   it('should handle unsupported operation gracefully', async () => {
    const items: ReaderInputItem[] = [
      { id: 'g', operation: 'readPdfMarkdown' as any, filePath: 'test.pdf' }, // Invalid operation for schema
    ];
    // Expect execute to throw or return validation error (depending on server impl)
    // For now, assume it returns an error in the output
    const input: ReaderToolInput = { items };
    // We expect Zod validation to fail before execute is called in a real server,
    // but here we test the execute function's internal handling if validation somehow passed.
    // Let's adjust the test to reflect what the *current* execute function does.
    // The current execute function relies on Zod validation happening *before* it's called.
    // Let's simulate the input passing Zod and see how execute handles the unknown op.
    const output = await readerTool.execute(input, WORKSPACE_ROOT, defaultOptions);

    // Since Zod validation happens *before* execute, readFile shouldn't be called.
    // However, our test calls execute directly. Let's test the internal switch case.
    expect(readFile).not.toHaveBeenCalled(); // Correct, switch case throws before read
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled();
    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toEqual(expect.objectContaining({
      id: 'g',
      success: false,
      error: expect.stringContaining('Unsupported reader operation'),
      suggestion: expect.stringContaining('Check the requested operation type'),
    }));
  });

  it('should fail for path outside workspace by default', async () => {
    const input: ReaderToolInput = { items: [{ id: 'h', operation: 'readPdfText', filePath: '../outside.pdf' }] };
    const output = await readerTool.execute(input, WORKSPACE_ROOT, defaultOptions);
    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toEqual(expect.objectContaining({
      id: 'h',
      success: false,
      error: expect.stringContaining('Path validation failed'), // Error comes from validateAndResolvePath
      suggestion: expect.any(String),
    }));
    expect(readFile).not.toHaveBeenCalled();
    expect(mupdfjs.PDFDocument.openDocument).not.toHaveBeenCalled();
  });

  it('should succeed reading PDF outside workspace when allowed', async () => {
    const input: ReaderToolInput = { items: [{ id: 'i', operation: 'readPdfText', filePath: '../outside.pdf' }] };
    const output = await readerTool.execute(input, WORKSPACE_ROOT, allowOutsideOptions);

    expect(readFile).toHaveBeenCalledWith(resolvedOutsidePath);
    // Check mupdf calls
    expect(mupdfjs.PDFDocument.openDocument).toHaveBeenCalledWith(mockFileBuffer, "application/pdf");
    expect(mockMuPdfDoc.countPages).toHaveBeenCalled();
    expect(mockMuPdfDoc.loadPage).toHaveBeenCalledWith(0); // mupdf is 0-indexed
    expect(mockMuPdfPage.toStructuredText).toHaveBeenCalledWith("preserve-whitespace");
    expect(mockStructuredText.asJSON).toHaveBeenCalled();
    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]).toEqual({
      id: 'i',
      success: true,
      result: 'Mock MuPDF text content', // Expected text from mockStructuredTextJson
    });
  });
});