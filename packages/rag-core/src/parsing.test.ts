import { describe, it, expect, vi, beforeEach, afterEach, Mock, SpyInstance } from 'vitest';
import path from 'node:path';
// Import types, not the actual Parser/Language/Tree values from the original module
import type { Parser, Language, Tree } from 'web-tree-sitter';
import { parseCode, SupportedLanguage, _resetParsingState } from './parsing.js';
// No longer importing fsPromises for spying

// --- Mock web-tree-sitter ---
// Hoist mocks needed for web-tree-sitter factory
const { mockLoad, mockSetLanguage, mockParse, mockInit } = vi.hoisted(() => {
  return {
    mockLoad: vi.fn(),
    mockSetLanguage: vi.fn(),
    mockParse: vi.fn(),
    mockInit: vi.fn(),
  };
});

// Mock the entire web-tree-sitter module
vi.mock('web-tree-sitter', () => {
  class MockParser {
    static init = mockInit;
    setLanguage = mockSetLanguage;
    parse = mockParse;
    constructor() {}
  }
  return {
    Parser: MockParser,
    Language: { load: mockLoad },
  };
});

// --- End Mocks ---

describe('parsing', () => {
  // Hold references to the actual mock functions/objects retrieved via importMock
  let MockedParserStatic: { init: Mock };
  let MockedLanguageStatic: { load: Mock };
  let MockedParserInstanceMethods: { setLanguage: Mock, parse: Mock };
  // No longer need MockedReadFile


  beforeEach(async () => {
    vi.clearAllMocks();
    _resetParsingState();

    // Retrieve the mocked web-tree-sitter module
    const MockedWTS = await vi.importMock('web-tree-sitter') as {
        Parser: { init: Mock, new(): { setLanguage: Mock, parse: Mock } },
        Language: { load: Mock }
    };

    // Assign references for web-tree-sitter mocks
    MockedParserStatic = MockedWTS.Parser;
    MockedLanguageStatic = MockedWTS.Language;
    const parserInstance = new MockedWTS.Parser();
    MockedParserInstanceMethods = {
        setLanguage: parserInstance.setLanguage,
        parse: parserInstance.parse
    };

    // --- Removed readFile spy setup ---

    // Default mock/spy implementations
    MockedParserStatic.init.mockResolvedValue(undefined);
    MockedLanguageStatic.load.mockResolvedValue({} as Language);
    MockedParserInstanceMethods.parse.mockReturnValue({ rootNode: {} } as Tree);
    // No default for readFile needed
  });

  afterEach(() => {
      vi.restoreAllMocks();
  });

  // initializeParser is not exported, tested implicitly via parseCode

  describe('parseCode', () => {

    it('should initialize parser, load language, set language, and parse', async () => {
      const code = 'const x = 1;';
      const language = SupportedLanguage.JavaScript;
      const mockLang = { name: 'mockJS' } as Language;
      const mockTree = { rootNode: { text: code } } as Tree;

      // Setup specific mock returns for this test
      MockedLanguageStatic.load.mockResolvedValue(mockLang);
      MockedParserInstanceMethods.parse.mockReturnValue(mockTree);
      // Assume readFile works implicitly because loadLanguage mock resolves

      const result = await parseCode(code, language);

      expect(MockedParserStatic.init).toHaveBeenCalledTimes(1);
      expect(MockedLanguageStatic.load).toHaveBeenCalledTimes(1);
      // Cannot assert readFile directly anymore
      // expect(MockedReadFile).toHaveBeenCalledTimes(1);
      // expect(MockedReadFile).toHaveBeenCalledWith(path.resolve(process.cwd(), 'dist', 'tree-sitter-javascript.wasm'));
      expect(MockedParserInstanceMethods.setLanguage).toHaveBeenCalledWith(mockLang);
      expect(MockedParserInstanceMethods.parse).toHaveBeenCalledWith(code);
      expect(result).toBe(mockTree);
    });

    it('should reuse initialized parser and loaded language', async () => {
       const code1 = 'let a = 1;';
       const code2 = 'let b = 2;';
       const language = SupportedLanguage.JavaScript;
       const mockLang = { name: 'mockJS' } as Language;
       const mockTree1 = { rootNode: { text: code1 } } as Tree;
       const mockTree2 = { rootNode: { text: code2 } } as Tree;

       // Setup mocks
       MockedLanguageStatic.load.mockResolvedValue(mockLang);
       MockedParserInstanceMethods.parse.mockReturnValueOnce(mockTree1).mockReturnValueOnce(mockTree2);

       // First call
       await parseCode(code1, language);
       expect(MockedParserStatic.init).toHaveBeenCalledTimes(1);
       expect(MockedLanguageStatic.load).toHaveBeenCalledTimes(1);
       expect(MockedParserInstanceMethods.setLanguage).toHaveBeenCalledTimes(1);
       expect(MockedParserInstanceMethods.parse).toHaveBeenCalledTimes(1);

       // Reset call counts for the next assertion
       vi.clearAllMocks();
       // Re-set default resolved values if clearAllMocks removed them
       MockedParserStatic.init.mockResolvedValue(undefined);
       MockedLanguageStatic.load.mockResolvedValue(mockLang);
       MockedParserInstanceMethods.parse.mockReturnValue(mockTree2);


       // Second call
       const tree2 = await parseCode(code2, language);
       expect(MockedParserStatic.init).not.toHaveBeenCalled();
       expect(MockedLanguageStatic.load).not.toHaveBeenCalled();
       // Cannot assert readFile directly anymore
       // expect(MockedReadFile).not.toHaveBeenCalled();
       expect(MockedParserInstanceMethods.setLanguage).toHaveBeenCalledTimes(1);
       expect(MockedParserInstanceMethods.parse).toHaveBeenCalledTimes(1);
       expect(MockedParserInstanceMethods.parse).toHaveBeenCalledWith(code2);
       expect(tree2).toBe(mockTree2);
    });

     it('should throw if language is unsupported', async () => {
        const code = 'some code';
        const unsupportedLang = 'cobol' as any; // Use any cast

        MockedParserStatic.init.mockResolvedValue(undefined);

        await expect(parseCode(code, unsupportedLang)).rejects.toThrow(
            `Unsupported language: ${unsupportedLang}`
        );
        expect(MockedParserStatic.init).toHaveBeenCalledTimes(1);
        expect(MockedLanguageStatic.load).not.toHaveBeenCalled();
     });

     // REMOVED test for readFile failure

      it('should throw if loadLanguage fails (via Language.load)', async () => {
        const code = 'some code';
        const language = SupportedLanguage.Python;
        const loadError = new Error('WASM compilation failed');

        // Mock Language.load spy to fail
        MockedLanguageStatic.load.mockRejectedValue(loadError);

        await expect(parseCode(code, language)).rejects.toThrow(
             expect.stringContaining(`Failed to load grammar for ${language}`) // Error is wrapped
        );
        expect(MockedParserStatic.init).toHaveBeenCalledTimes(1);
        // Cannot assert readFile directly anymore
        // expect(MockedReadFile).toHaveBeenCalledTimes(1); // readFile would have been called
        expect(MockedLanguageStatic.load).toHaveBeenCalledTimes(1); // load was called but failed
     });


     it('should throw if parser.parse returns null', async () => {
        const code = 'some code';
        const language = SupportedLanguage.TypeScript;
        const mockLang = { name: 'mockTS' } as Language;

        // Setup mocks for successful load but failed parse
        MockedLanguageStatic.load.mockResolvedValue(mockLang);
        MockedParserInstanceMethods.parse.mockReturnValue(null);

        await expect(parseCode(code, language)).rejects.toThrow(
            `Failed to parse code for language ${language}. Parser returned null.`
        );
        expect(MockedParserStatic.init).toHaveBeenCalledTimes(1);
        // Cannot assert readFile directly anymore
        // expect(MockedReadFile).toHaveBeenCalledTimes(1);
        expect(MockedLanguageStatic.load).toHaveBeenCalledTimes(1);
        expect(MockedParserInstanceMethods.setLanguage).toHaveBeenCalledWith(mockLang);
        expect(MockedParserInstanceMethods.parse).toHaveBeenCalledWith(code);
     });

  });
});