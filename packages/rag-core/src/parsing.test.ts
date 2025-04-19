import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { Parser, Language, Tree } from 'web-tree-sitter';
import { parseCode, SupportedLanguage, _resetParsingState } from './parsing.js';
import * as fsPromises from 'node:fs/promises'; // Import fsPromises

// --- Mock web-tree-sitter ---
// Hoist mocks to be available inside vi.mock factory
// Hoist ALL mocks needed
const { mockLoad, mockSetLanguage, mockParse, mockInit, mockReadFile } = vi.hoisted(() => {
  return {
    mockLoad: vi.fn(),
    mockSetLanguage: vi.fn(),
    mockParse: vi.fn(),
    mockInit: vi.fn(),
    mockReadFile: vi.fn(), // Hoisted correctly
  };
});

// Mock the entire web-tree-sitter module
vi.mock('web-tree-sitter', () => {
  // Define a mock class that mimics the Parser structure
  class MockParser {
    // Static method mock
    static init = mockInit;

    // Instance method mocks
    setLanguage = mockSetLanguage;
    parse = mockParse;

    constructor() {
      // Constructor mock can be simple or track calls if needed
      // console.log('MockParser constructor called');
    }
  }

  return {
    // Export the mock class as 'Parser'
    Parser: MockParser,
    // Mock Language as an object containing the static load method
    Language: {
      load: mockLoad,
    },
    // Tree: class MockTree {}, // If needed
  };
});

// Mock node:fs/promises specifically for readFile
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal() as typeof fsPromises;
  return {
    ...actual, // Keep other fs functions
    readFile: mockReadFile, // Use our hoisted mock
  };
});
// --- End Mocks ---

describe('parsing', () => {
  // Reset mocks and internal state before each test
  beforeEach(() => {
    // vi.resetModules(); // resetModules can cause issues with mocks, use clearAllMocks and explicit reset instead
    vi.clearAllMocks(); // Clear call history etc.
    _resetParsingState(); // Call the explicit reset function for internal state
    // mockInit.mockClear(); // vi.clearAllMocks() handles this
    // mockLoad.mockClear();
    // mockSetLanguage.mockClear();
    // mockParse.mockClear();
  });

  afterEach(() => {
      vi.restoreAllMocks();
  });

  // initializeParser is not exported, tested implicitly via parseCode

  describe('parseCode', () => {
    // Tests here will implicitly test initializeParser and loadLanguage logic
    // by checking if mockInit, mockLoad, mockSetLanguage, mockParse are called correctly.

    it('should initialize parser, load language, set language, and parse', async () => {
      const code = 'const x = 1;';
      const language = SupportedLanguage.JavaScript;
      const mockLang = { name: 'mockJS' } as Language; // Mock Language object
      const mockTree = { rootNode: { text: code } } as Tree; // Mock Tree object

      // Setup mocks for a successful run
      mockInit.mockResolvedValue(undefined);
      mockLoad.mockResolvedValue(mockLang);
      mockParse.mockReturnValue(mockTree);

      const result = await parseCode(code, language);

      expect(mockInit).toHaveBeenCalledTimes(1); // Initialize called
      expect(mockLoad).toHaveBeenCalledTimes(1);
      // Check if load was called with the correct WASM path (needs path mock adjustment or careful assertion)
      // For now, just check it was called
      // expect(mockLoad).toHaveBeenCalledWith(expect.stringContaining('tree-sitter-javascript.wasm'));
      expect(mockSetLanguage).toHaveBeenCalledWith(mockLang); // Set language called
      expect(mockParse).toHaveBeenCalledWith(code); // Parse called
      expect(result).toBe(mockTree); // Returns the parsed tree
    });

    it('should reuse initialized parser and loaded language', async () => {
       const code1 = 'let a = 1;';
       const code2 = 'let b = 2;';
       const language = SupportedLanguage.JavaScript;
       const mockLang = { name: 'mockJS' } as Language;
       const mockTree1 = { rootNode: { text: code1 } } as Tree;
       const mockTree2 = { rootNode: { text: code2 } } as Tree;

       // Setup mocks
       mockInit.mockResolvedValue(undefined);
       mockLoad.mockResolvedValue(mockLang);
       mockParse.mockReturnValueOnce(mockTree1).mockReturnValueOnce(mockTree2);

       // First call
       await parseCode(code1, language);
       expect(mockInit).toHaveBeenCalledTimes(1);
       expect(mockLoad).toHaveBeenCalledTimes(1);
       expect(mockSetLanguage).toHaveBeenCalledTimes(1);
       expect(mockParse).toHaveBeenCalledTimes(1);

       // Second call
       await parseCode(code2, language);
       expect(mockInit).toHaveBeenCalledTimes(1); // Not called again
       expect(mockLoad).toHaveBeenCalledTimes(1); // Not called again
       expect(mockSetLanguage).toHaveBeenCalledTimes(2); // Called again
       expect(mockParse).toHaveBeenCalledTimes(2); // Called again
    });

     it('should throw if language is unsupported', async () => {
        const code = 'some code';
        // Cast an invalid value to bypass enum check for testing
        const unsupportedLang = 'cobol' as SupportedLanguage;

        mockInit.mockResolvedValue(undefined); // Assume init works

        await expect(parseCode(code, unsupportedLang)).rejects.toThrow(
            `Unsupported language or missing WASM path for: ${unsupportedLang}`
        );
        expect(mockInit).toHaveBeenCalledTimes(1);
        expect(mockLoad).not.toHaveBeenCalled(); // Load should not be called
     });

     it('should throw if Language.load fails', async () => {
        const code = 'some code';
        const language = SupportedLanguage.Python;
        const readFileError = new Error('ENOENT: Failed to read WASM file');

        mockInit.mockResolvedValue(undefined);
        // Mock readFile to fail for this test
        mockReadFile.mockRejectedValue(readFileError);
        // mockLoad should not be called if readFile fails, so no need to mock it here

        await expect(parseCode(code, language)).rejects.toThrow(
            `Failed to load grammar for ${language}` // The error thrown by loadLanguage wraps the readFile error
        );
        expect(mockInit).toHaveBeenCalledTimes(1);
        expect(mockReadFile).toHaveBeenCalledTimes(1); // Check readFile was called
        expect(mockLoad).not.toHaveBeenCalled(); // Language.load should not be called
        expect(mockSetLanguage).not.toHaveBeenCalled();
     });

     it('should throw if parser.parse returns null', async () => {
        const code = 'some code';
        const language = SupportedLanguage.TypeScript;
        const mockLang = { name: 'mockTS' } as Language;

        mockInit.mockResolvedValue(undefined);
        // Mock readFile to succeed for this test
        mockReadFile.mockResolvedValue(Buffer.from('mock wasm content'));
        mockLoad.mockResolvedValue(mockLang);
        mockParse.mockReturnValue(null);

        await expect(parseCode(code, language)).rejects.toThrow(
            `Failed to parse code for language ${language}. Parser returned null.`
        );
        expect(mockInit).toHaveBeenCalledTimes(1);
        expect(mockReadFile).toHaveBeenCalledTimes(1); // Check readFile was called
        expect(mockLoad).toHaveBeenCalledTimes(1); // Check Language.load was called
        expect(mockSetLanguage).toHaveBeenCalledWith(mockLang);
        expect(mockParse).toHaveBeenCalledWith(code);
     });

  });
});